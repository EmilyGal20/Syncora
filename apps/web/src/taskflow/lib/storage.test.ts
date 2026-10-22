// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { DATA_VERSION, sanitizeData } from './storage';

const v1Task = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Task ${id}`,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  dueTime: null,
  projectId: null,
  category: null,
  tags: [],
  subtasks: [],
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  completedAt: null,
  ...extra,
});

const v1Data = (tasks: unknown[]) => ({
  version: 1,
  tasks,
  projects: [{ id: 'p1', name: 'Alpha', description: '', color: '#8b5cf6', createdAt: '2026-09-01T00:00:00.000Z' }],
  activity: [],
  notifications: [],
  notificationKeys: [],
  settings: { userName: 'Sam', theme: 'dark', dailyGoal: 7, weekStartsOn: 0, deadlineAlerts: false },
});

describe('sanitizeData migration', () => {
  it('migrates v1 data to the current version and keeps everything the user had', () => {
    const data = sanitizeData(v1Data([v1Task('a', { projectId: 'p1', tags: ['x'] }), v1Task('b', { status: 'done', completedAt: '2026-10-02T10:00:00.000Z' })]))!;
    expect(data.version).toBe(DATA_VERSION);
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0]).toMatchObject({ id: 'a', projectId: 'p1', tags: ['x'], notes: '', recurrence: null });
    expect(data.tasks[1].completedAt).toBe('2026-10-02T10:00:00.000Z');
    expect(data.settings).toEqual({ userName: 'Sam', theme: 'dark', dailyGoal: 7, weekStartsOn: 0, deadlineAlerts: false });
  });

  it('assigns board positions that follow the previous due-date order', () => {
    const data = sanitizeData(
      v1Data([v1Task('later', { dueDate: '2026-10-20' }), v1Task('none'), v1Task('soon', { dueDate: '2026-10-10' })]),
    )!;
    const byOrder = [...data.tasks].sort((a, b) => a.order - b.order).map((t) => t.id);
    expect(byOrder).toEqual(['soon', 'later', 'none']);
    expect(data.tasks.every((t) => Number.isFinite(t.order))).toBe(true);
  });

  it('keeps existing positions and appends tasks that have none', () => {
    const data = sanitizeData(v1Data([v1Task('kept', { order: 5000 }), v1Task('new')]))!;
    const kept = data.tasks.find((t) => t.id === 'kept')!;
    const added = data.tasks.find((t) => t.id === 'new')!;
    expect(kept.order).toBe(5000);
    expect(added.order).toBeGreaterThan(5000);
  });

  it('upgrades v2 recurrence rules', () => {
    const data = sanitizeData(v1Data([v1Task('r', { dueDate: '2026-10-10', recurrence: { frequency: 'monthly', interval: 2 } })]))!;
    expect(data.tasks[0].recurrence).toEqual({ frequency: 'monthly', interval: 2, until: null, anchorDay: null });
  });

  it('repairs invalid fields instead of dropping the task', () => {
    const data = sanitizeData(
      v1Data([v1Task('x', { status: 'archived', priority: 'critical', dueDate: '2026-13-40', dueTime: '25:00', projectId: 'missing' })]),
    )!;
    expect(data.tasks[0]).toMatchObject({ status: 'todo', priority: 'medium', dueDate: null, dueTime: null, projectId: null });
  });

  it('rejects data that is not a TaskFlow backup', () => {
    expect(sanitizeData(null)).toBeNull();
    expect(sanitizeData({ tasks: 'nope' })).toBeNull();
    expect(sanitizeData([])).toBeNull();
  });

  it('drops tasks without a title', () => {
    expect(sanitizeData(v1Data([v1Task('ok'), { id: 'bad', title: '   ' }, 42]))!.tasks.map((t) => t.id)).toEqual(['ok']);
  });
});

describe('stored data after the AI Planner', () => {
  it('keeps the data version at 2 (the AI Planner adds no stored fields)', () => {
    expect(DATA_VERSION).toBe(2);
  });

  it('loads current v2 data unchanged, including AI-planned tasks with negative board positions', () => {
    const now = '2026-10-11T09:00:00.000Z';
    const task = (id: string, extra: Record<string, unknown> = {}) => ({
      ...v1Task(id),
      notes: '',
      recurrence: null,
      order: 1024,
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
    const data = {
      version: 2,
      tasks: [
        task('ai', {
          projectId: 'p1',
          tags: ['ai-plan'],
          order: -2048,
          dueDate: '2026-10-13',
          description: 'Do it.\n\nEstimated time: 1h 30m\nPlanned with AI Planner (demo) from goal: "Ship"',
          subtasks: [{ id: 's_1', title: 'Sub', done: false }],
        }),
        task('rec', { dueDate: '2026-10-10', recurrence: { frequency: 'weekly', interval: 1, until: null, anchorDay: null } }),
        task('done', { status: 'done', completedAt: now, order: 0 }),
      ],
      projects: v1Data([]).projects,
      activity: [{ id: 'a1', type: 'task_created', message: 'Created 1 task from AI Planner', at: now }],
      notifications: [],
      notificationKeys: [],
      settings: v1Data([]).settings,
    };
    expect(sanitizeData(data)).toEqual(data);
  });

  it('still migrates v1 data without inventing AI fields', () => {
    const data = sanitizeData(v1Data([v1Task('a')]))!;
    expect(data.version).toBe(2);
    expect(Object.keys(data.tasks[0]).sort()).toEqual(
      ['category', 'completedAt', 'createdAt', 'description', 'dueDate', 'dueTime', 'id', 'notes', 'order', 'priority', 'projectId', 'recurrence', 'status', 'subtasks', 'tags', 'title', 'updatedAt'],
    );
    expect(data.tasks[0].tags).toEqual([]);
  });
});
