// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { formatEstimate, suggestionToTaskInput } from './toTaskInput';
import { sanitizeData } from '../storage';
import type { PlanSuggestion } from './types';

const suggestion: PlanSuggestion = {
  key: 's0',
  title: 'Build core functionality: website',
  description: 'Focus on the most important part first.',
  priority: 'high',
  estimateMinutes: 90,
  dueDate: '2026-10-13',
  subtasks: ['Set up the workspace', 'Implement the main feature'],
  dateAdjusted: false,
};

describe('formatEstimate', () => {
  it.each([
    [15, '15m'],
    [45, '45m'],
    [60, '1h'],
    [90, '1h 30m'],
    [120, '2h'],
    [480, '8h'],
  ])('%i → %s', (minutes, label) => {
    expect(formatEstimate(minutes)).toBe(label);
  });
});

describe('suggestionToTaskInput', () => {
  it('maps every field', () => {
    const input = suggestionToTaskInput(suggestion, { projectId: 'p1', goal: 'Build my website by Tuesday', source: 'demo' });
    expect(input).toMatchObject({
      title: 'Build core functionality: website',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-10-13',
      dueTime: null,
      projectId: 'p1',
      category: null,
      tags: ['ai-plan'],
      notes: '',
      recurrence: null,
    });
    expect(input.description).toBe(
      'Focus on the most important part first.\n\nEstimated time: 1h 30m\nPlanned with AI Planner (demo) from goal: "Build my website by Tuesday"',
    );
    expect(input.subtasks.map((s) => [s.title, s.done])).toEqual([
      ['Set up the workspace', false],
      ['Implement the main feature', false],
    ]);
    expect(new Set(input.subtasks.map((s) => s.id)).size).toBe(2);
  });

  it('labels AI plans and truncates the goal to 200 characters', () => {
    const goal = 'g'.repeat(300);
    const input = suggestionToTaskInput({ ...suggestion, description: '' }, { projectId: null, goal, source: 'ai' });
    expect(input.description).toBe(`Estimated time: 1h 30m\nPlanned with AI Planner (AI) from goal: "${'g'.repeat(200)}"`);
    expect(input.projectId).toBeNull();
  });

  it('survives sanitizeData unchanged', () => {
    const input = suggestionToTaskInput(suggestion, { projectId: 'p1', goal: 'Build my website', source: 'demo' });
    const now = '2026-10-11T09:00:00.000Z';
    const task = { ...input, id: 't1', order: 1024, createdAt: now, updatedAt: now, completedAt: null };
    const data = sanitizeData({
      version: 2,
      tasks: [task],
      projects: [{ id: 'p1', name: 'Website', description: '', color: '#8b5cf6', createdAt: now }],
      activity: [],
      notifications: [],
      notificationKeys: [],
      settings: {},
    });
    expect(data?.tasks[0]).toEqual(task);
  });
});

describe('suggestionToTaskInput saving compatibility', () => {
  const now = '2026-10-11T09:00:00.000Z';
  const project = { id: 'p1', name: 'Website', description: '', color: '#8b5cf6', createdAt: now };
  const asTask = (input: ReturnType<typeof suggestionToTaskInput>, id: string, order: number) => ({
    ...input,
    id,
    order,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
  const v2 = (tasks: unknown[], projects: unknown[] = [project]) => ({
    version: 2,
    tasks,
    projects,
    activity: [],
    notifications: [],
    notificationKeys: [],
    settings: { userName: 'Sam', theme: 'light', dailyGoal: 5, weekStartsOn: 1, deadlineAlerts: true },
  });

  it('keeps every field of maximum-size, unicode and negative-order tasks through sanitizeData', () => {
    const big: PlanSuggestion = {
      ...suggestion,
      title: 'ת'.repeat(200),
      description: 'Line one\nLine two 🚀 '.repeat(50).slice(0, 1000),
      priority: 'urgent',
      estimateMinutes: 480,
      subtasks: Array.from({ length: 8 }, (_, i) => `${i}`.padEnd(200, 'x')),
    };
    const a = asTask(suggestionToTaskInput(big, { projectId: 'p1', goal: 'גדול '.repeat(100), source: 'ai' }), 't1', -2048);
    const b = asTask(suggestionToTaskInput({ ...suggestion, dueDate: '', subtasks: [] }, { projectId: null, goal: 'x', source: 'demo' }), 't2', 0);
    const data = sanitizeData(v2([a, b]))!;
    expect(data.version).toBe(2);
    expect(data.tasks).toEqual([a, b]);
    expect(data.tasks[1].dueDate).toBeNull();
    expect(a.description).toContain('Estimated time: 8h\nPlanned with AI Planner (AI) from goal: "');
    // A second pass changes nothing either.
    expect(sanitizeData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('falls back to no project when the project no longer exists', () => {
    const t = asTask(suggestionToTaskInput(suggestion, { projectId: 'p1', goal: 'g', source: 'demo' }), 't1', 0);
    expect(sanitizeData(v2([t], []))!.tasks[0].projectId).toBeNull();
  });

  it('gives fresh, unique subtask ids on every call', () => {
    const many: PlanSuggestion = { ...suggestion, subtasks: Array.from({ length: 8 }, (_, i) => `Step ${i}`) };
    const first = suggestionToTaskInput(many, { projectId: null, goal: 'g', source: 'demo' });
    const second = suggestionToTaskInput(many, { projectId: null, goal: 'g', source: 'demo' });
    const ids = [...first.subtasks, ...second.subtasks].map((s) => s.id);
    expect(new Set(ids).size).toBe(16);
    expect(ids.every((id) => id.startsWith('s_'))).toBe(true);
  });

  it('drops blank subtasks and trims titles', () => {
    const input = suggestionToTaskInput({ ...suggestion, title: '  Padded  ', subtasks: ['  a  ', '   ', ''] }, { projectId: null, goal: 'g', source: 'demo' });
    expect(input.title).toBe('Padded');
    expect(input.subtasks.map((s) => s.title)).toEqual(['a']);
  });
});
