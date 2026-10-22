// @ts-nocheck
import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { completionHeatmap, completionStreak, getOverview, longestStreak, rangeSummary } from './stats';

const now = new Date(2026, 9, 11, 15, 0); // Sun Oct 11 2026, 3 PM
let n = 0;
const task = (over: Partial<Task> = {}): Task => ({
  id: `t${++n}`,
  title: 'Task',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  dueTime: null,
  projectId: null,
  category: null,
  tags: [],
  subtasks: [],
  notes: '',
  recurrence: null,
  order: n,
  createdAt: '2026-09-01T09:00:00',
  updatedAt: '2026-09-01T09:00:00',
  completedAt: null,
  ...over,
});
const done = (completedAt: string, over: Partial<Task> = {}) => task({ status: 'done', completedAt, ...over });

describe('rangeSummary', () => {
  it('compares the range with the previous period', () => {
    const list = [done('2026-10-10T10:00:00'), done('2026-10-05T10:00:00'), done('2026-10-01T10:00:00'), done('2026-09-20T10:00:00')];
    const s = rangeSummary(list, now, 7); // Oct 5–11 vs Sep 28–Oct 4
    expect(s.completed).toBe(2);
    expect(s.previousCompleted).toBe(1);
    expect(s.change).toBe(100);
  });

  it('measures on-time completion against the due time, or the end of the due day', () => {
    const list = [
      done('2026-10-10T09:00:00', { dueDate: '2026-10-10', dueTime: '10:00' }), // on time
      done('2026-10-10T11:00:00', { dueDate: '2026-10-10', dueTime: '10:00' }), // late
      done('2026-10-09T23:00:00', { dueDate: '2026-10-09' }), // on time
      done('2026-10-09T08:00:00'), // no due date: excluded
    ];
    const s = rangeSummary(list, now, 7);
    expect(s.onTimeSample).toBe(3);
    expect(s.onTimeRate).toBe(67);
  });

  it('returns no on-time rate when nothing had a due date', () => {
    expect(rangeSummary([done('2026-10-10T09:00:00')], now, 7).onTimeRate).toBeNull();
  });
});

describe('streaks', () => {
  const list = [
    done('2026-10-11T08:00:00'),
    done('2026-10-10T08:00:00'),
    done('2026-10-09T08:00:00'),
    done('2026-10-01T08:00:00'),
    done('2026-09-02T08:00:00'),
    done('2026-09-03T08:00:00'),
    done('2026-09-04T08:00:00'),
    done('2026-09-05T08:00:00'),
  ];
  it('counts the current streak ending today', () => expect(completionStreak(list, now)).toBe(3));
  it('finds the longest streak ever', () => expect(longestStreak(list)).toBe(4));
  it('keeps yesterday’s streak alive until today ends', () => {
    expect(completionStreak([done('2026-10-10T08:00:00'), done('2026-10-09T08:00:00')], now)).toBe(2);
  });
});

describe('completionHeatmap', () => {
  it('lays out whole weeks ending with the current one and scales levels', () => {
    const grid = completionHeatmap([done('2026-10-05T08:00:00'), done('2026-10-05T09:00:00'), done('2026-10-06T08:00:00')], now, 2, 1);
    expect(grid).toHaveLength(2);
    expect(grid[1][0].date).toBe('2026-10-05'); // Monday of this week
    expect(grid[1][0]).toMatchObject({ count: 2, level: 4 });
    expect(grid[1][1]).toMatchObject({ count: 1, level: 2 });
    expect(grid[1][6]).toMatchObject({ date: '2026-10-11', future: false });
  });
});

describe('getOverview', () => {
  it('counts today, overdue and goal progress', () => {
    const list = [task({ dueDate: '2026-10-11' }), done('2026-10-11T09:00:00', { dueDate: '2026-10-11' }), task({ dueDate: '2026-10-01' })];
    const o = getOverview(list, now, 4);
    expect(o).toMatchObject({ total: 3, completed: 1, overdue: 1, todayTotal: 2, todayDone: 1, productivity: 50, goalProgress: 25 });
  });
});
