// @ts-nocheck
import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { DEFAULT_FILTERS, batchTopOrders, filterTasks, matchesSearch, sanitizeFilters, searchScore, sortTasks } from './tasks';

const now = new Date(2026, 9, 11, 12, 0); // Oct 11 2026, noon
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
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  completedAt: null,
  ...over,
});

describe('search', () => {
  it('matches words across title, notes, tags and subtasks', () => {
    const t = task({ title: 'Ship release', notes: 'check staging', tags: ['mobile'], subtasks: [{ id: 's', title: 'QA pass', done: false }] });
    expect(matchesSearch(t, 'ship staging')).toBe(true);
    expect(matchesSearch(t, 'qa')).toBe(true);
    expect(matchesSearch(t, 'ship missing')).toBe(false);
  });

  it('treats #term as a tag prefix filter', () => {
    const t = task({ title: 'Fix crash', tags: ['android', 'bug'] });
    expect(matchesSearch(t, '#andr')).toBe(true);
    expect(matchesSearch(t, '#ios')).toBe(false);
    expect(matchesSearch(t, '#bug crash')).toBe(true);
    // A word that happens to be a tag name still matches as text.
    expect(matchesSearch(t, 'android')).toBe(true);
  });

  it('ranks title-prefix matches above other matches, open tasks above done', () => {
    const a = task({ title: 'Report for investors' });
    const b = task({ title: 'Quarterly report' });
    const c = task({ title: 'Misc', description: 'report' });
    const d = task({ title: 'Report archive', status: 'done' });
    const ranked = [c, b, d, a].sort((x, y) => searchScore(y, 'report') - searchScore(x, 'report')).map((t) => t.title);
    expect(ranked).toEqual(['Report for investors', 'Report archive', 'Quarterly report', 'Misc']);
  });
});

describe('filterTasks', () => {
  const list = [
    task({ title: 'overdue', dueDate: '2026-10-10' }),
    task({ title: 'today', dueDate: '2026-10-11' }),
    task({ title: 'this week', dueDate: '2026-10-15', tags: ['x'] }),
    task({ title: 'later', dueDate: '2026-11-30' }),
    task({ title: 'no date' }),
    task({ title: 'done today', dueDate: '2026-10-11', status: 'done' }),
  ];
  const titles = (f: Partial<typeof DEFAULT_FILTERS>) => filterTasks(list, { ...DEFAULT_FILTERS, ...f }, now).map((t) => t.title);

  it('filters by due window', () => {
    expect(titles({ due: 'overdue' })).toEqual(['overdue']);
    expect(titles({ due: 'today' })).toEqual(['today', 'done today']);
    expect(titles({ due: 'week' })).toEqual(['today', 'this week', 'done today']);
    expect(titles({ due: 'upcoming' })).toEqual(['later']);
    expect(titles({ due: 'none' })).toEqual(['no date']);
  });

  it('filters by tag and status', () => {
    expect(titles({ tag: 'x' })).toEqual(['this week']);
    expect(titles({ status: 'open', due: 'today' })).toEqual(['today']);
  });
});

describe('sortTasks', () => {
  it('puts tasks without a due date last and breaks ties by priority', () => {
    const list = [task({ title: 'none' }), task({ title: 'b', dueDate: '2026-10-12', priority: 'low' }), task({ title: 'a', dueDate: '2026-10-12', priority: 'urgent' })];
    expect(sortTasks(list, { key: 'dueDate', reversed: false }).map((t) => t.title)).toEqual(['a', 'b', 'none']);
  });
});

describe('sanitizeFilters', () => {
  it('restores saved filters and drops invalid values', () => {
    expect(sanitizeFilters({ status: 'open', priority: 'nope', due: 'week', tag: 'x', search: 5 })).toEqual({
      ...DEFAULT_FILTERS,
      status: 'open',
      due: 'week',
      tag: 'x',
    });
    expect(sanitizeFilters(null)).toEqual(DEFAULT_FILTERS);
  });
});

describe('batchTopOrders', () => {
  const existing = [
    { status: 'todo' as const, order: 1024 },
    { status: 'todo' as const, order: 2048 },
    { status: 'done' as const, order: 5000 },
  ];

  it('puts the batch above the column, first input on top, in input order', () => {
    const orders = batchTopOrders(existing, ['todo', 'todo', 'todo'], 1024);
    expect(orders).toEqual([-2048, -1024, 0]);
    expect(Math.max(...orders)).toBeLessThan(1024);
  });

  it('handles several columns independently', () => {
    expect(batchTopOrders(existing, ['todo', 'in_progress', 'todo', 'in_progress'], 1024)).toEqual([-1024, 0, 0, 1024]);
  });

  it('works for an empty column and an empty batch', () => {
    expect(batchTopOrders([], ['todo', 'todo'], 1024)).toEqual([0, 1024]);
    expect(batchTopOrders(existing, [], 1024)).toEqual([]);
  });
});

describe('batchTopOrders with mixed statuses', () => {
  const existing = [
    { status: 'todo' as const, order: 3072 },
    { status: 'todo' as const, order: -512.5 },
    { status: 'in_progress' as const, order: 4096 },
    { status: 'done' as const, order: 0 },
    { status: 'done' as const, order: 9999 },
  ];
  const statuses = ['done', 'todo', 'in_progress', 'todo', 'done', 'todo', 'in_progress', 'todo'] as const;

  it('keeps each column increasing in input order, unique, and above that column’s existing tasks', () => {
    const orders = batchTopOrders(existing, [...statuses], 1024);
    expect(orders).toHaveLength(statuses.length);
    for (const status of ['todo', 'in_progress', 'done'] as const) {
      const mine = orders.filter((_, i) => statuses[i] === status);
      const theirs = existing.filter((t) => t.status === status).map((t) => t.order);
      for (let i = 1; i < mine.length; i++) expect(mine[i]).toBeGreaterThan(mine[i - 1]);
      expect(new Set([...mine, ...theirs]).size).toBe(mine.length + theirs.length);
      expect(Math.max(...mine)).toBeLessThan(Math.min(...theirs));
      expect(mine.every(Number.isFinite)).toBe(true);
    }
  });

  it('puts the batch above an empty column’s start and works with other step sizes', () => {
    const orders = batchTopOrders([], ['done', 'todo', 'done'], 10);
    expect(orders).toEqual([0, 10, 10]);
    const big = batchTopOrders(existing, Array.from({ length: 10 }, () => 'todo' as const), 1);
    expect(big).toEqual(Array.from({ length: 10 }, (_, i) => -513.5 - 9 + i));
  });
});
