// @ts-nocheck
import type { DueFilter, Priority, Project, Task, TaskFilters, TaskSort, TaskStatus } from '../types';
import { diffInDays, parseISODate } from './date';

export const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];
export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

export const STATUS_META: Record<TaskStatus, { label: string; dot: string; color: string }> = {
  todo: { label: 'To Do', dot: 'bg-slate-400', color: '#94a3b8' },
  in_progress: { label: 'In Progress', dot: 'bg-amber-400', color: '#f59e0b' },
  done: { label: 'Completed', dot: 'bg-emerald-500', color: '#10b981' },
};

export const PRIORITY_META: Record<Priority, { label: string; rank: number; color: string; badge: string }> = {
  urgent: {
    label: 'Urgent',
    rank: 4,
    color: '#e11d48',
    badge: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
  },
  high: {
    label: 'High',
    rank: 3,
    color: '#d97706',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  },
  medium: {
    label: 'Medium',
    rank: 2,
    color: '#8b5cf6',
    badge: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
  },
  low: {
    label: 'Low',
    rank: 1,
    color: '#0ea5e9',
    badge: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  },
};

export const PROJECT_COLORS = ['#8b5cf6', '#6366f1', '#0ea5e9', '#14b8a6', '#10b981', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#64748b'];

export const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Design', 'Development', 'Marketing', 'Health', 'Learning', 'Finance'];

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  projectId: 'all',
  tag: 'all',
  due: 'all',
};

export const DUE_FILTER_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'upcoming', label: 'Later than 7 days' },
  { value: 'none', label: 'No due date' },
];

const STATUS_FILTERS = ['all', 'open', 'overdue', 'todo', 'in_progress', 'done'];

/** Validates filters restored from storage; unknown values fall back to "all". */
export function sanitizeFilters(raw: unknown): TaskFilters {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_FILTERS;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, fallback: string) => (typeof v === 'string' ? v.slice(0, 200) : fallback);
  return {
    search: text(r.search, ''),
    status: STATUS_FILTERS.includes(r.status as string) ? (r.status as TaskFilters['status']) : 'all',
    priority: PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : 'all',
    category: text(r.category, 'all'),
    projectId: text(r.projectId, 'all'),
    tag: text(r.tag, 'all'),
    due: DUE_FILTER_OPTIONS.some((o) => o.value === r.due) ? (r.due as DueFilter) : 'all',
  };
}

export const SORT_OPTIONS: { key: TaskSort['key']; label: string }[] = [
  { key: 'dueDate', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'createdAt', label: 'Date created' },
  { key: 'updatedAt', label: 'Last updated' },
  { key: 'title', label: 'Title' },
];

/** The moment a task becomes overdue: its due time, or the end of its due day. */
export function dueDateTime(task: Pick<Task, 'dueDate' | 'dueTime'>): Date | null {
  if (!task.dueDate) return null;
  const d = parseISODate(task.dueDate);
  if (task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

export function isOverdue(task: Task, now: Date): boolean {
  if (task.status === 'done') return false;
  const due = dueDateTime(task);
  return due !== null && due.getTime() < now.getTime();
}

export function isDueOn(task: Task, day: Date): boolean {
  return task.dueDate !== null && diffInDays(parseISODate(task.dueDate), day) === 0;
}

export function subtaskProgress(task: Task): { done: number; total: number } {
  return { done: task.subtasks.filter((s) => s.done).length, total: task.subtasks.length };
}

/** Splits a query into plain words and `#tag` terms. */
export function parseQuery(query: string): { words: string[]; tags: string[] } {
  const words: string[] = [];
  const tags: string[] = [];
  for (const raw of query.trim().toLowerCase().split(/\s+/)) {
    if (!raw) continue;
    if (raw.startsWith('#') && raw.length > 1) tags.push(raw.slice(1));
    else words.push(raw);
  }
  return { words, tags };
}

/**
 * Every plain word must appear in the task's text (title, description, notes, category,
 * project, tags or subtasks); every `#term` must prefix one of its tags.
 */
export function matchesSearch(task: Task, query: string, projects: Project[] = []): boolean {
  const { words, tags } = parseQuery(query);
  if (!words.length && !tags.length) return true;
  if (!tags.every((term) => task.tags.some((tag) => tag.toLowerCase().startsWith(term)))) return false;
  if (!words.length) return true;
  const project = projects.find((p) => p.id === task.projectId);
  const haystack = [
    task.title,
    task.description,
    task.notes,
    task.category ?? '',
    project?.name ?? '',
    ...task.tags,
    ...task.subtasks.map((s) => s.title),
  ]
    .join(' ')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** Higher is better: title prefix > title word > title substring > elsewhere. */
export function searchScore(task: Task, query: string): number {
  const { words } = parseQuery(query);
  const title = task.title.toLowerCase();
  let score = task.status === 'done' ? 0 : 1;
  for (const w of words) {
    if (title.startsWith(w)) score += 30;
    else if (title.split(/[^\p{L}\p{N}]+/u).some((part) => part.startsWith(w))) score += 20;
    else if (title.includes(w)) score += 10;
  }
  return score;
}

function matchesDue(task: Task, due: DueFilter, now: Date): boolean {
  if (due === 'all') return true;
  if (due === 'none') return task.dueDate === null;
  if (!task.dueDate) return false;
  if (due === 'overdue') return isOverdue(task, now);
  const diff = diffInDays(parseISODate(task.dueDate), now);
  if (due === 'today') return diff === 0;
  if (due === 'week') return diff >= 0 && diff <= 7;
  return diff > 7;
}

export function filterTasks(tasks: Task[], filters: TaskFilters, now: Date, projects: Project[] = []): Task[] {
  return tasks.filter((t) => {
    if (filters.status === 'overdue' && !isOverdue(t, now)) return false;
    if (filters.status === 'open' && t.status === 'done') return false;
    if (filters.status !== 'all' && filters.status !== 'overdue' && filters.status !== 'open' && t.status !== filters.status)
      return false;
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
    if (filters.category !== 'all' && (t.category ?? '') !== filters.category) return false;
    if (filters.projectId !== 'all') {
      if (filters.projectId === 'none' ? t.projectId !== null : t.projectId !== filters.projectId) return false;
    }
    if (filters.tag !== 'all' && !t.tags.includes(filters.tag)) return false;
    if (!matchesDue(t, filters.due, now)) return false;
    return matchesSearch(t, filters.search, projects);
  });
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.category !== 'all' ||
    filters.projectId !== 'all' ||
    filters.tag !== 'all' ||
    filters.due !== 'all'
  );
}

/** Number of filters (excluding search) that narrow the list. */
export function countActiveFilters(filters: TaskFilters, ignoreStatus = false): number {
  return [
    !ignoreStatus && filters.status !== 'all',
    filters.priority !== 'all',
    filters.category !== 'all',
    filters.projectId !== 'all',
    filters.tag !== 'all',
    filters.due !== 'all',
  ].filter(Boolean).length;
}

function compareDue(a: Task, b: Task): number {
  const da = dueDateTime(a)?.getTime() ?? Number.POSITIVE_INFINITY;
  const db = dueDateTime(b)?.getTime() ?? Number.POSITIVE_INFINITY;
  return da === db ? 0 : da < db ? -1 : 1;
}

const comparators: Record<TaskSort['key'], (a: Task, b: Task) => number> = {
  dueDate: (a, b) => compareDue(a, b) || PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank,
  priority: (a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || compareDue(a, b),
  createdAt: (a, b) => b.createdAt.localeCompare(a.createdAt),
  updatedAt: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
};

export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  const cmp = comparators[sort.key];
  return [...tasks].sort((a, b) => (sort.reversed ? -cmp(a, b) : cmp(a, b)));
}

export function getCategories(tasks: Task[]): string[] {
  const set = new Set(DEFAULT_CATEGORIES);
  tasks.forEach((t) => t.category && set.add(t.category));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function getTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  tasks.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export type DueGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export const DUE_GROUP_LABELS: Record<DueGroup, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 days',
  later: 'Later',
  none: 'No due date',
};

export function dueGroup(task: Task, now: Date): DueGroup {
  if (!task.dueDate) return 'none';
  if (isOverdue(task, now)) return 'overdue';
  const diff = diffInDays(parseISODate(task.dueDate), now);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'week';
  return 'later';
}

/**
 * Board positions for a batch of new tasks: the first task of each status goes to the top of
 * its column and the rest follow in input order, all above the existing tasks.
 */
export function batchTopOrders(existing: Pick<Task, 'status' | 'order'>[], statuses: TaskStatus[], step: number): number[] {
  const counts = new Map<TaskStatus, number>();
  for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1);
  const next = new Map<TaskStatus, number>();
  for (const [status, count] of counts) {
    const orders = existing.filter((t) => t.status === status).map((t) => t.order);
    const top = orders.length ? Math.min(...orders) - step : step;
    next.set(status, top - (count - 1) * step);
  }
  return statuses.map((s) => {
    const order = next.get(s)!;
    next.set(s, order + step);
    return order;
  });
}
