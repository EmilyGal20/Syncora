// @ts-nocheck
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  /** Repeat every N units (ignored for weekdays). */
  interval: number;
  /** Last date (YYYY-MM-DD) an occurrence may fall on; null repeats forever. */
  until: string | null;
  /**
   * Day of month the series started on (monthly/yearly). Keeps a task that starts
   * on the 31st from drifting to the 28th after February.
   */
  anchorDay: number | null;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  /** Local calendar date, YYYY-MM-DD */
  dueDate: string | null;
  /** Local time, HH:mm */
  dueTime: string | null;
  projectId: string | null;
  category: string | null;
  tags: string[];
  subtasks: Subtask[];
  /** Free-form working notes, separate from the description. */
  notes: string;
  recurrence: Recurrence | null;
  /** Manual position within its board column (lower = higher up). */
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Fields a user can provide when creating or editing a task. */
export type TaskInput = Pick<
  Task,
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'dueDate'
  | 'dueTime'
  | 'projectId'
  | 'category'
  | 'tags'
  | 'subtasks'
  | 'notes'
  | 'recurrence'
>;

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export type ProjectInput = Pick<Project, 'name' | 'description' | 'color'>;

export type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_reopened'
  | 'task_moved'
  | 'task_deleted'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted';

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  taskId?: string;
  projectId?: string;
  at: string;
}

export type NotificationKind = 'info' | 'success' | 'warning' | 'danger';

export interface AppNotification {
  id: string;
  /** De-duplication key so the same alert is never raised twice. */
  key: string;
  kind: NotificationKind;
  title: string;
  message: string;
  taskId?: string;
  at: string;
  read: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Settings {
  userName: string;
  theme: ThemePreference;
  dailyGoal: number;
  weekStartsOn: 0 | 1;
  deadlineAlerts: boolean;
}

export interface AppData {
  version: 2;
  tasks: Task[];
  projects: Project[];
  activity: Activity[];
  notifications: AppNotification[];
  notificationKeys: string[];
  settings: Settings;
}

export type SortKey = 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';

export type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'upcoming' | 'none';

export interface TaskFilters {
  search: string;
  status: TaskStatus | 'all' | 'open' | 'overdue';
  priority: Priority | 'all';
  category: string;
  projectId: string;
  /** A tag name, or 'all'. */
  tag: string;
  due: DueFilter;
}

export interface TaskSort {
  key: SortKey;
  reversed: boolean;
}
