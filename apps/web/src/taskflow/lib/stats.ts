// @ts-nocheck
import type { Priority, Project, Task } from '../types';
import { addDays, formatShortDate, isSameDay, startOfDay, startOfWeek, toISODate } from './date';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, dueDateTime, isDueOn, isOverdue } from './tasks';
import { percent } from './utils';

const completedOn = (t: Task, day: Date) => t.completedAt !== null && isSameDay(new Date(t.completedAt), day);
const createdOn = (t: Task, day: Date) => isSameDay(new Date(t.createdAt), day);

export interface Overview {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  overdue: number;
  completionRate: number;
  /** Tasks relevant to today: due today, or completed today. */
  todayTotal: number;
  todayDone: number;
  /** Share of today's tasks that are done. */
  productivity: number;
  completedToday: number;
  /** Progress toward the user's daily completion goal. */
  goalProgress: number;
}

export function getOverview(tasks: Task[], now: Date, dailyGoal: number): Overview {
  const completed = tasks.filter((t) => t.status === 'done').length;
  const todays = tasks.filter((t) => isDueOn(t, now) || completedOn(t, now));
  const todayDone = todays.filter((t) => t.status === 'done').length;
  const completedToday = tasks.filter((t) => completedOn(t, now)).length;
  return {
    total: tasks.length,
    completed,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
    completionRate: percent(completed, tasks.length),
    todayTotal: todays.length,
    todayDone,
    productivity: percent(todayDone, todays.length),
    completedToday,
    goalProgress: Math.min(100, percent(completedToday, Math.max(1, dailyGoal))),
  };
}

export interface DayPoint {
  date: string;
  label: string;
  fullLabel: string;
  completed: number;
  created: number;
}

export function dailySeries(tasks: Task[], now: Date, days: number): DayPoint[] {
  const start = addDays(startOfDay(now), -(days - 1));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(start, i);
    return {
      date: toISODate(day),
      label: days <= 7 ? day.toLocaleDateString(undefined, { weekday: 'short' }) : formatShortDate(day, now),
      fullLabel: day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      completed: tasks.filter((t) => completedOn(t, day)).length,
      created: tasks.filter((t) => createdOn(t, day)).length,
    };
  });
}

export interface WeekPoint {
  label: string;
  completed: number;
  created: number;
  rate: number;
}

export function weeklySeries(tasks: Task[], now: Date, weeks: number, weekStartsOn: 0 | 1): WeekPoint[] {
  const thisWeek = startOfWeek(now, weekStartsOn);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = addDays(start, 7);
    const inRange = (iso: string | null) => iso !== null && new Date(iso) >= start && new Date(iso) < end;
    const completed = tasks.filter((t) => inRange(t.completedAt)).length;
    const created = tasks.filter((t) => inRange(t.createdAt)).length;
    return {
      label: i === weeks - 1 ? 'This week' : formatShortDate(start, now),
      completed,
      created,
      rate: Math.min(100, percent(completed, Math.max(created, completed))),
    };
  });
}

export function weekComparison(tasks: Task[], now: Date, weekStartsOn: 0 | 1) {
  const [lastWeek, thisWeek] = weeklySeries(tasks, now, 2, weekStartsOn);
  const change =
    lastWeek.completed === 0
      ? thisWeek.completed > 0
        ? 100
        : 0
      : Math.round(((thisWeek.completed - lastWeek.completed) / lastWeek.completed) * 100);
  return { thisWeek: thisWeek.completed, lastWeek: lastWeek.completed, change };
}

export interface PrioritySlice {
  priority: Priority;
  label: string;
  color: string;
  total: number;
  open: number;
  completed: number;
}

export function tasksByPriority(tasks: Task[]): PrioritySlice[] {
  return PRIORITIES.map((p) => {
    const list = tasks.filter((t) => t.priority === p);
    const completed = list.filter((t) => t.status === 'done').length;
    return {
      priority: p,
      label: PRIORITY_META[p].label,
      color: PRIORITY_META[p].color,
      total: list.length,
      completed,
      open: list.length - completed,
    };
  });
}

export function tasksByStatus(tasks: Task[]) {
  return STATUSES.map((s) => ({
    status: s,
    label: STATUS_META[s].label,
    color: STATUS_META[s].color,
    value: tasks.filter((t) => t.status === s).length,
  }));
}

export interface ProjectStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  overdue: number;
  progress: number;
}

export function projectStats(projectId: string | null, tasks: Task[], now: Date): ProjectStats {
  const list = tasks.filter((t) => t.projectId === projectId);
  const completed = list.filter((t) => t.status === 'done').length;
  return {
    total: list.length,
    completed,
    inProgress: list.filter((t) => t.status === 'in_progress').length,
    todo: list.filter((t) => t.status === 'todo').length,
    overdue: list.filter((t) => isOverdue(t, now)).length,
    progress: percent(completed, list.length),
  };
}

export function tasksByProject(tasks: Task[], projects: Project[], now: Date) {
  const rows = projects.map((p) => ({ id: p.id, name: p.name, color: p.color, ...projectStats(p.id, tasks, now) }));
  const unassigned = projectStats(null, tasks, now);
  if (unassigned.total > 0) rows.push({ id: 'none', name: 'No project', color: '#94a3b8', ...unassigned });
  return rows;
}

/** Consecutive days with at least one completion, ending today (or yesterday if nothing is done yet today). */
export function completionStreak(tasks: Task[], now: Date): number {
  const days = new Set(tasks.filter((t) => t.completedAt).map((t) => toISODate(new Date(t.completedAt!))));
  let cursor = startOfDay(now);
  if (!days.has(toISODate(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(toISODate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function averageCompletionHours(tasks: Task[]): number | null {
  const durations = tasks
    .filter((t) => t.completedAt)
    .map((t) => new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime())
    .filter((ms) => ms >= 0);
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000;
}

export function completionsByWeekday(tasks: Task[], weekStartsOn: 0 | 1) {
  const counts = Array(7).fill(0) as number[];
  tasks.forEach((t) => {
    if (t.completedAt) counts[new Date(t.completedAt).getDay()]++;
  });
  const sunday = new Date(2023, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const dow = (i + weekStartsOn) % 7;
    return { label: addDays(sunday, dow).toLocaleDateString(undefined, { weekday: 'short' }), completed: counts[dow] };
  });
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/** The current calendar week (respecting the week start), with future days flagged. */
export function currentWeekSeries(tasks: Task[], now: Date, weekStartsOn: 0 | 1) {
  const start = startOfWeek(now, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    return {
      label: day.toLocaleDateString(undefined, { weekday: 'short' }),
      fullLabel: day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
      isToday: isSameDay(day, now),
      isFuture: day > now && !isSameDay(day, now),
      completed: tasks.filter((t) => completedOn(t, day)).length,
      due: tasks.filter((t) => isDueOn(t, day)).length,
    };
  });
}

/** Completions in the last `days` days compared with the `days` before that. */
export function productivityTrend(tasks: Task[], now: Date, days: number) {
  const series = dailySeries(tasks, now, days * 2);
  const previous = series.slice(0, days).reduce((s, d) => s + d.completed, 0);
  const recent = series.slice(days).reduce((s, d) => s + d.completed, 0);
  const change = previous === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - previous) / previous) * 100);
  return { series: series.slice(days), recent, previous, change };
}

export interface RangeSummary {
  days: number;
  completed: number;
  previousCompleted: number;
  /** Percent change versus the previous period of the same length. */
  change: number;
  created: number;
  /** Share of tasks completed in the range (with a due date) that were done by their deadline. */
  onTimeRate: number | null;
  onTimeSample: number;
  /** Average completions per day across the range. */
  perDay: number;
}

export function rangeSummary(tasks: Task[], now: Date, days: number): RangeSummary {
  const end = addDays(startOfDay(now), 1);
  const start = addDays(end, -days);
  const prevStart = addDays(start, -days);
  const within = (iso: string | null, from: Date, to: Date) => iso !== null && new Date(iso) >= from && new Date(iso) < to;
  const done = tasks.filter((t) => within(t.completedAt, start, end));
  const previousCompleted = tasks.filter((t) => within(t.completedAt, prevStart, start)).length;
  const withDue = done.filter((t) => t.dueDate);
  const onTime = withDue.filter((t) => new Date(t.completedAt!) <= dueDateTime(t)!).length;
  return {
    days,
    completed: done.length,
    previousCompleted,
    change: previousCompleted === 0 ? (done.length > 0 ? 100 : 0) : Math.round(((done.length - previousCompleted) / previousCompleted) * 100),
    created: tasks.filter((t) => within(t.createdAt, start, end)).length,
    onTimeRate: withDue.length ? percent(onTime, withDue.length) : null,
    onTimeSample: withDue.length,
    perDay: Math.round((done.length / days) * 10) / 10,
  };
}

/** Longest run of consecutive days with at least one completion, ever. */
export function longestStreak(tasks: Task[]): number {
  const days = [...new Set(tasks.filter((t) => t.completedAt).map((t) => toISODate(new Date(t.completedAt!))))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of days) {
    const [y, m, d] = iso.split('-').map(Number);
    const day = new Date(y, m - 1, d);
    run = prev && toISODate(addDays(prev, 1)) === iso ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export interface HeatCell {
  date: string;
  count: number;
  /** 0 = none, 1–4 = quartiles of the busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** Completions per day as week columns (oldest first), for a contribution-style heatmap. */
export function completionHeatmap(tasks: Task[], now: Date, weeks: number, weekStartsOn: 0 | 1): HeatCell[][] {
  const counts = new Map<string, number>();
  tasks.forEach((t) => {
    if (!t.completedAt) return;
    const key = toISODate(new Date(t.completedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const first = addDays(startOfWeek(now, weekStartsOn), -7 * (weeks - 1));
  const today = startOfDay(now);
  const grid = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(first, w * 7 + d);
      const date = toISODate(day);
      return { date, count: counts.get(date) ?? 0, future: day > today };
    }),
  );
  const max = Math.max(1, ...grid.flat().map((c) => c.count));
  return grid.map((week) =>
    week.map((c) => ({ ...c, level: (c.count === 0 ? 0 : Math.min(4, Math.ceil((c.count / max) * 4))) as HeatCell['level'] })),
  );
}

/** Completions grouped by hour of day (local time). */
export function completionsByHour(tasks: Task[]) {
  const counts = Array(24).fill(0) as number[];
  tasks.forEach((t) => {
    if (t.completedAt) counts[new Date(t.completedAt).getHours()]++;
  });
  return counts.map((completed, hour) => ({
    hour,
    label: new Date(2020, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' }),
    completed,
  }));
}
