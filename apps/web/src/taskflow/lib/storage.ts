// @ts-nocheck
import type { Activity, AppData, AppNotification, Priority, Project, Settings, Subtask, Task, TaskStatus } from '../types';
import { isValidISODate, isValidTime } from './date';
import { DEFAULT_SETTINGS } from './sampleData';
import { PRIORITIES, PROJECT_COLORS, STATUSES, sortTasks } from './tasks';
import { sanitizeRecurrence } from './recurrence';
import { uid } from './utils';

/** The key never changes, so data from every earlier version is found and migrated in place. */
export const STORAGE_KEY = 'taskflow:data:v1';
export const BACKUP_KEY = 'taskflow:backup:before-v2';
export const DATA_VERSION = 2;
export const ORDER_STEP = 1024;

export function storageKey(workspaceId?: string) {
  return workspaceId ? `${STORAGE_KEY}:${workspaceId}` : STORAGE_KEY;
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const isoOr = (v: unknown, fallback: string) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback);

function sanitizeTask(raw: unknown, projectIds: Set<string>, now: string): Task | null {
  if (!isObj(raw) || typeof raw.title !== 'string' || !raw.title.trim()) return null;
  const status = STATUSES.includes(raw.status as TaskStatus) ? (raw.status as TaskStatus) : 'todo';
  const createdAt = isoOr(raw.createdAt, now);
  const dueDate = isValidISODate(raw.dueDate) ? raw.dueDate : null;
  return {
    id: str(raw.id) || uid('t_'),
    title: raw.title.trim().slice(0, 200),
    description: str(raw.description).slice(0, 5000),
    status,
    priority: PRIORITIES.includes(raw.priority as Priority) ? (raw.priority as Priority) : 'medium',
    dueDate,
    dueTime: dueDate && isValidTime(raw.dueTime) ? raw.dueTime : null,
    projectId: typeof raw.projectId === 'string' && projectIds.has(raw.projectId) ? raw.projectId : null,
    category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [],
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks
          .filter((s): s is Raw => isObj(s) && typeof s.title === 'string')
          .map((s): Subtask => ({ id: str(s.id) || uid('s_'), title: str(s.title), done: s.done === true }))
      : [],
    // Fields added after v1 default safely for older data.
    notes: str(raw.notes).slice(0, 10000),
    recurrence: sanitizeRecurrence(raw.recurrence),
    // NaN marks "no saved position"; assignMissingOrder fills it in below.
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : Number.NaN,
    createdAt,
    updatedAt: isoOr(raw.updatedAt, createdAt),
    completedAt: status === 'done' ? isoOr(raw.completedAt, now) : null,
  };
}

function sanitizeProject(raw: unknown, now: string): Project | null {
  if (!isObj(raw) || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return {
    id: str(raw.id) || uid('p_'),
    name: raw.name.trim().slice(0, 60),
    description: str(raw.description).slice(0, 300),
    color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : PROJECT_COLORS[0],
    createdAt: isoOr(raw.createdAt, now),
  };
}

function sanitizeSettings(raw: unknown): Settings {
  if (!isObj(raw)) return { ...DEFAULT_SETTINGS };
  const goal = Number(raw.dailyGoal);
  return {
    userName: str(raw.userName, DEFAULT_SETTINGS.userName).trim().slice(0, 40) || DEFAULT_SETTINGS.userName,
    theme: raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : 'light',
    dailyGoal: Number.isInteger(goal) && goal >= 1 && goal <= 50 ? goal : DEFAULT_SETTINGS.dailyGoal,
    weekStartsOn: raw.weekStartsOn === 0 ? 0 : 1,
    deadlineAlerts: raw.deadlineAlerts !== false,
  };
}

/** Validates untrusted data (localStorage or an imported file) and fills in defaults. Returns null if unusable. */
export function sanitizeData(raw: unknown): AppData | null {
  if (!isObj(raw) || !Array.isArray(raw.tasks) || !Array.isArray(raw.projects)) return null;
  const now = new Date().toISOString();
  const projects = raw.projects.map((p) => sanitizeProject(p, now)).filter((p): p is Project => p !== null);
  const projectIds = new Set(projects.map((p) => p.id));
  const tasks = assignMissingOrder(raw.tasks.map((t) => sanitizeTask(t, projectIds, now)).filter((t): t is Task => t !== null));
  const activity = Array.isArray(raw.activity)
    ? raw.activity.filter((a): a is Activity => isObj(a) && typeof a.message === 'string' && typeof a.at === 'string')
    : [];
  const notifications = Array.isArray(raw.notifications)
    ? raw.notifications.filter(
        (n): n is AppNotification => isObj(n) && typeof n.title === 'string' && typeof n.id === 'string' && typeof n.at === 'string',
      )
    : [];
  const notificationKeys = Array.isArray(raw.notificationKeys)
    ? raw.notificationKeys.filter((k): k is string => typeof k === 'string')
    : [];
  return {
    version: DATA_VERSION,
    tasks,
    projects,
    activity: activity.slice(0, 100),
    notifications: notifications.slice(0, 50),
    notificationKeys: notificationKeys.slice(-500),
    settings: sanitizeSettings(raw.settings),
  };
}

/**
 * Gives tasks without a manual board position one that matches how the board used to look
 * (sorted by due date within each column), placed after any tasks that already have one.
 */
function assignMissingOrder(tasks: Task[]): Task[] {
  if (!tasks.some((t) => Number.isNaN(t.order))) return tasks;
  const assigned = new Map<string, number>();
  for (const status of STATUSES) {
    const column = tasks.filter((t) => t.status === status);
    let next = Math.max(0, ...column.filter((t) => !Number.isNaN(t.order)).map((t) => t.order)) + ORDER_STEP;
    for (const t of sortTasks(column.filter((t) => Number.isNaN(t.order)), { key: 'dueDate', reversed: false })) {
      assigned.set(t.id, next);
      next += ORDER_STEP;
    }
  }
  return tasks.map((t) => (assigned.has(t.id) ? { ...t, order: assigned.get(t.id)! } : t));
}

export function loadData(workspaceId?: string): AppData | null {
  try {
    const key = storageKey(workspaceId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const version = isObj(parsed) ? Number(parsed.version) : NaN;
    // Keep an untouched copy of older data before the first save in the new format.
    if (version !== DATA_VERSION && localStorage.getItem(BACKUP_KEY) === null) {
      try {
        localStorage.setItem(BACKUP_KEY, raw);
      } catch {
        /* storage full: migrate anyway, the original stays readable until the next save */
      }
    }
    return sanitizeData(parsed);
  } catch {
    return null;
  }
}

export function saveData(data: AppData, workspaceId?: string): boolean {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
