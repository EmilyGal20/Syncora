// @ts-nocheck
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type {
  Activity,
  ActivityType,
  AppData,
  AppNotification,
  Project,
  ProjectInput,
  Settings,
  Task,
  TaskInput,
  TaskStatus,
} from '../types';
import { createEmptyData, createSampleData } from '../lib/sampleData';
import { ORDER_STEP, loadData, saveData, storageKey } from '../lib/storage';
import { STATUS_META, batchTopOrders } from '../lib/tasks';
import { nextOccurrence } from '../lib/recurrence';
import { formatShortDate, parseISODate } from '../lib/date';
import { uid } from '../lib/utils';

type Action =
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: Partial<Task> }
  | { type: 'task/delete'; id: string }
  | { type: 'project/add'; project: Project }
  | { type: 'project/update'; id: string; patch: Partial<Project> }
  | { type: 'project/delete'; id: string; now: string }
  | { type: 'activity/log'; entry: Activity }
  | { type: 'notifications/add'; items: AppNotification[] }
  | { type: 'notifications/read'; id: string }
  | { type: 'notifications/readAll' }
  | { type: 'notifications/clear' }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'data/replace'; data: AppData };

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'task/add':
      return { ...state, tasks: [action.task, ...state.tasks.filter((t) => t.id !== action.task.id)] };
    case 'task/update':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case 'task/delete':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        notifications: state.notifications.filter((n) => n.taskId !== action.id),
      };
    case 'project/add':
      return { ...state, projects: [...state.projects, action.project] };
    case 'project/update':
      return { ...state, projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'project/delete':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.map((t) => (t.projectId === action.id ? { ...t, projectId: null, updatedAt: action.now } : t)),
      };
    case 'activity/log':
      return { ...state, activity: [action.entry, ...state.activity].slice(0, 100) };
    case 'notifications/add':
      return {
        ...state,
        notifications: [...action.items, ...state.notifications].slice(0, 50),
        notificationKeys: [...state.notificationKeys, ...action.items.map((n) => n.key)].slice(-500),
      };
    case 'notifications/read':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case 'notifications/readAll':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'notifications/clear':
      return { ...state, notifications: [] };
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'data/replace':
      return action.data;
  }
}

/** Keeps completedAt consistent with status whenever a task changes. */
function withStatusBookkeeping(task: Task, patch: Partial<Task>, now: string): Partial<Task> {
  const next: Partial<Task> = { ...patch, updatedAt: now };
  if (patch.status && patch.status !== task.status) {
    next.completedAt = patch.status === 'done' ? now : null;
  }
  return next;
}

/** Fields that can be patched on a task: user input plus its board position. */
export type TaskPatch = Partial<TaskInput> & { order?: number };

export interface DataState extends AppData {
  storageError: boolean;
}

export interface DataActions {
  /** Latest state without subscribing to changes (for event handlers). */
  getState: () => AppData;
  createTask: (input: TaskInput) => Task;
  /**
   * Creates several tasks at once with one activity entry. The first input lands at the top of
   * its column and the rest follow in input order.
   */
  createTasks: (inputs: TaskInput[], activityMessage: string) => Task[];
  /**
   * Returns the next occurrence when completing a recurring task. When a recurring task
   * is completed and nothing is returned, its series has reached its end date.
   */
  updateTask: (id: string, patch: TaskPatch) => Task | undefined;
  /** Moves a task to a board column, placing it before `beforeId` (or last when null). */
  moveTask: (id: string, status: TaskStatus, beforeId: string | null) => Task | undefined;
  setStatus: (id: string, status: TaskStatus) => Task | undefined;
  toggleComplete: (id: string) => Task | undefined;
  /** Saves notes without adding an activity entry for every edit. */
  updateNotes: (id: string, notes: string) => void;
  /** Removes a task silently (used to undo an auto-created recurrence). */
  discardTask: (id: string) => void;
  bulkUpdate: (ids: string[], patch: TaskPatch) => Task[];
  bulkDelete: (ids: string[]) => Task[];
  restoreTasks: (tasks: Task[]) => void;
  deleteTask: (id: string) => Task | undefined;
  restoreTask: (task: Task) => void;
  duplicateTask: (id: string) => Task | undefined;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;
  createProject: (input: ProjectInput) => Project;
  updateProject: (id: string, patch: Partial<ProjectInput>) => void;
  deleteProject: (id: string) => void;
  addNotifications: (items: Omit<AppNotification, 'id' | 'at' | 'read'>[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceData: (data: AppData) => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
}

export type DataApi = DataState & DataActions;

const DataStateContext = createContext<DataState | null>(null);
const DataActionsContext = createContext<DataActions | null>(null);

/** Lowest-order position at the top of a board column. */
function topOrder(tasks: Task[], status: TaskStatus): number {
  const orders = tasks.filter((t) => t.status === status).map((t) => t.order);
  return orders.length ? Math.min(...orders) - ORDER_STEP : ORDER_STEP;
}

function initialState(workspaceId?: string): AppData {
  return loadData(workspaceId) ?? createSampleData();
}

export function DataProvider({ children, workspaceId }: { children: ReactNode; workspaceId?: string }) {
  const [state, dispatch] = useReducer(reducer, workspaceId, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scopeRef = useRef(workspaceId);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    if (scopeRef.current === workspaceId) return;
    scopeRef.current = workspaceId;
    dispatch({ type: 'data/replace', data: initialState(workspaceId) });
  }, [workspaceId]);

  useEffect(() => {
    setStorageError(!saveData(state, workspaceId));
  }, [state, workspaceId]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const key = storageKey(workspaceId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      const next = loadData(workspaceId);
      if (next) dispatch({ type: 'data/replace', data: next });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [workspaceId]);

  const log = useCallback((type: ActivityType, message: string, refs: Pick<Activity, 'taskId' | 'projectId'> = {}) => {
    dispatch({ type: 'activity/log', entry: { id: uid('a_'), type, message, at: new Date().toISOString(), ...refs } });
  }, []);

  const findTask = (id: string) => stateRef.current.tasks.find((t) => t.id === id);

  const createTask = useCallback(
    (input: TaskInput): Task => {
      const now = new Date().toISOString();
      const task: Task = {
        ...input,
        id: uid('t_'),
        order: topOrder(stateRef.current.tasks, input.status),
        createdAt: now,
        updatedAt: now,
        completedAt: input.status === 'done' ? now : null,
      };
      dispatch({ type: 'task/add', task });
      log('task_created', `Created “${task.title}”`, { taskId: task.id });
      return task;
    },
    [log],
  );

  const createTasks = useCallback(
    (inputs: TaskInput[], activityMessage: string): Task[] => {
      if (!inputs.length) return [];
      const now = new Date().toISOString();
      // stateRef only refreshes on render, so compute every position here instead of
      // calling createTask repeatedly (which would give all of them the same order).
      const orders = batchTopOrders(stateRef.current.tasks, inputs.map((i) => i.status), ORDER_STEP);
      const created = inputs.map(
        (input, i): Task => ({
          ...input,
          id: uid('t_'),
          order: orders[i],
          createdAt: now,
          updatedAt: now,
          completedAt: input.status === 'done' ? now : null,
        }),
      );
      // task/add prepends, so add in reverse to keep the input order in the task list too.
      for (let i = created.length - 1; i >= 0; i--) dispatch({ type: 'task/add', task: created[i] });
      log('task_created', activityMessage);
      return created;
    },
    [log],
  );

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      const task = findTask(id);
      if (!task) return;
      const now = new Date().toISOString();
      // Moving a monthly/yearly task to a new date restarts its anchor day from that date.
      if (patch.dueDate !== undefined && patch.dueDate !== task.dueDate && (patch.recurrence ?? task.recurrence)?.anchorDay) {
        patch = { ...patch, recurrence: { ...(patch.recurrence ?? task.recurrence)!, anchorDay: null } };
      }
      const merged = { ...task, ...patch };
      const completingRecurring = patch.status === 'done' && task.status !== 'done' && merged.recurrence !== null;
      // The series moves on to the new occurrence, so the completed copy stops repeating.
      const finalPatch = completingRecurring ? { ...patch, recurrence: null } : patch;
      dispatch({ type: 'task/update', id, patch: withStatusBookkeeping(task, finalPatch, now) });
      const title = merged.title;
      let spawned: Task | undefined;
      const next = completingRecurring ? nextOccurrence(merged.dueDate, merged.recurrence!) : null;
      if (next) {
        spawned = {
          ...merged,
          id: uid('t_'),
          status: 'todo',
          dueDate: next.dueDate,
          recurrence: next.rule,
          order: topOrder(stateRef.current.tasks, 'todo'),
          subtasks: merged.subtasks.map((st) => ({ ...st, id: uid('s_'), done: false })),
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        };
        dispatch({ type: 'task/add', task: spawned });
      }
      if (patch.status && patch.status !== task.status) {
        if (patch.status === 'done') log('task_completed', `Completed “${title}”`, { taskId: id });
        else if (task.status === 'done') log('task_reopened', `Reopened “${title}”`, { taskId: id });
        else log('task_moved', `Moved “${title}” to ${STATUS_META[patch.status].label}`, { taskId: id });
      } else if (Object.keys(patch).some((k) => k !== 'order')) {
        log('task_updated', `Updated “${title}”`, { taskId: id });
      }
      if (spawned) {
        log('task_created', `Scheduled next “${title}” for ${formatShortDate(parseISODate(spawned.dueDate!))}`, { taskId: spawned.id });
      }
      return spawned;
    },
    [log],
  );

  const setStatus = useCallback((id: string, status: TaskStatus) => updateTask(id, { status }), [updateTask]);

  const toggleComplete = useCallback(
    (id: string) => {
      const task = findTask(id);
      return task ? updateTask(id, { status: task.status === 'done' ? 'todo' : 'done' }) : undefined;
    },
    [updateTask],
  );

  const moveTask = useCallback(
    (id: string, status: TaskStatus, beforeId: string | null) => {
      const task = findTask(id);
      if (!task) return undefined;
      let column = stateRef.current.tasks.filter((t) => t.status === status && t.id !== id).sort((a, b) => a.order - b.order);
      const indexOf = () => (beforeId ? column.findIndex((t) => t.id === beforeId) : -1);
      const orderAt = (index: number): number => {
        const before = index >= 0 ? column[index] : undefined;
        const after = index > 0 ? column[index - 1] : index === -1 ? column[column.length - 1] : undefined;
        if (before && after) return (before.order + after.order) / 2;
        if (before) return before.order - ORDER_STEP;
        return (after?.order ?? 0) + ORDER_STEP;
      };
      let order = orderAt(indexOf());
      const index = indexOf();
      // Floating-point gaps eventually run out; respace the column evenly when they get too small.
      if (index > 0 && column[index].order - column[index - 1].order < 1e-6) {
        column = column.map((t, i) => ({ ...t, order: (i + 1) * ORDER_STEP }));
        column.forEach((t) => dispatch({ type: 'task/update', id: t.id, patch: { order: t.order } }));
        order = orderAt(index);
      }
      if (status === task.status) {
        if (order !== task.order) dispatch({ type: 'task/update', id, patch: { order } });
        return undefined;
      }
      return updateTask(id, { status, order });
    },
    [updateTask],
  );

  const updateNotes = useCallback((id: string, notes: string) => {
    if (findTask(id)) dispatch({ type: 'task/update', id, patch: { notes: notes.slice(0, 10000), updatedAt: new Date().toISOString() } });
  }, []);

  const discardTask = useCallback((id: string) => dispatch({ type: 'task/delete', id }), []);

  const bulkUpdate = useCallback(
    (ids: string[], patch: TaskPatch) =>
      ids.map((id) => updateTask(id, patch)).filter((t): t is Task => t !== undefined),
    [updateTask],
  );

  const bulkDelete = useCallback(
    (ids: string[]) => {
      const removed = stateRef.current.tasks.filter((t) => ids.includes(t.id));
      removed.forEach((t) => dispatch({ type: 'task/delete', id: t.id }));
      if (removed.length) log('task_deleted', removed.length === 1 ? `Deleted “${removed[0].title}”` : `Deleted ${removed.length} tasks`);
      return removed;
    },
    [log],
  );

  const restoreTasks = useCallback(
    (list: Task[]) => {
      const projectIds = new Set(stateRef.current.projects.map((p) => p.id));
      list.forEach((t) =>
        dispatch({ type: 'task/add', task: { ...t, projectId: t.projectId && projectIds.has(t.projectId) ? t.projectId : null } }),
      );
      if (list.length) log('task_created', list.length === 1 ? `Restored “${list[0].title}”` : `Restored ${list.length} tasks`);
    },
    [log],
  );

  const deleteTask = useCallback(
    (id: string) => {
      const task = findTask(id);
      if (!task) return undefined;
      dispatch({ type: 'task/delete', id });
      log('task_deleted', `Deleted “${task.title}”`);
      return task;
    },
    [log],
  );

  const restoreTask = useCallback(
    (task: Task) => {
      const projectExists = stateRef.current.projects.some((p) => p.id === task.projectId);
      dispatch({ type: 'task/add', task: { ...task, projectId: projectExists ? task.projectId : null } });
      log('task_created', `Restored “${task.title}”`, { taskId: task.id });
    },
    [log],
  );

  const duplicateTask = useCallback(
    (id: string) => {
      const task = findTask(id);
      if (!task) return undefined;
      const { id: _id, createdAt: _c, updatedAt: _u, completedAt: _d, ...input } = task;
      return createTask({
        ...input,
        title: `${task.title} (copy)`.slice(0, 200),
        status: task.status === 'done' ? 'todo' : task.status,
        subtasks: task.subtasks.map((s) => ({ ...s, id: uid('s_') })),
      });
    },
    [createTask],
  );

  // Subtask edits are frequent and small, so they don't flood the activity feed.
  const patchSubtasks = useCallback((taskId: string, fn: (subs: Task['subtasks']) => Task['subtasks']) => {
    const task = findTask(taskId);
    if (task) dispatch({ type: 'task/update', id: taskId, patch: { subtasks: fn(task.subtasks), updatedAt: new Date().toISOString() } });
  }, []);

  const toggleSubtask = useCallback(
    (taskId: string, subtaskId: string) =>
      patchSubtasks(taskId, (subs) => subs.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s))),
    [patchSubtasks],
  );
  const addSubtask = useCallback(
    (taskId: string, title: string) => {
      const clean = title.trim().slice(0, 200);
      if (clean) patchSubtasks(taskId, (subs) => [...subs, { id: uid('s_'), title: clean, done: false }]);
    },
    [patchSubtasks],
  );
  const removeSubtask = useCallback(
    (taskId: string, subtaskId: string) => patchSubtasks(taskId, (subs) => subs.filter((s) => s.id !== subtaskId)),
    [patchSubtasks],
  );

  const createProject = useCallback(
    (input: ProjectInput): Project => {
      const project: Project = { ...input, id: uid('p_'), createdAt: new Date().toISOString() };
      dispatch({ type: 'project/add', project });
      log('project_created', `Created project “${project.name}”`, { projectId: project.id });
      return project;
    },
    [log],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<ProjectInput>) => {
      const project = stateRef.current.projects.find((p) => p.id === id);
      if (!project) return;
      dispatch({ type: 'project/update', id, patch });
      log('project_updated', `Updated project “${patch.name ?? project.name}”`, { projectId: id });
    },
    [log],
  );

  const deleteProject = useCallback(
    (id: string) => {
      const project = stateRef.current.projects.find((p) => p.id === id);
      if (!project) return;
      dispatch({ type: 'project/delete', id, now: new Date().toISOString() });
      log('project_deleted', `Deleted project “${project.name}”`);
    },
    [log],
  );

  const addNotifications = useCallback((items: Omit<AppNotification, 'id' | 'at' | 'read'>[]) => {
    const known = new Set(stateRef.current.notificationKeys);
    const fresh = items
      .filter((n) => !known.has(n.key))
      .map((n) => ({ ...n, id: uid('n_'), at: new Date().toISOString(), read: false }));
    if (fresh.length) dispatch({ type: 'notifications/add', items: fresh });
  }, []);

  const actions = useMemo<DataActions>(
    () => ({
      getState: () => stateRef.current,
      createTask,
      createTasks,
      updateTask,
      moveTask,
      setStatus,
      toggleComplete,
      updateNotes,
      discardTask,
      bulkUpdate,
      bulkDelete,
      restoreTasks,
      deleteTask,
      restoreTask,
      duplicateTask,
      toggleSubtask,
      addSubtask,
      removeSubtask,
      createProject,
      updateProject,
      deleteProject,
      addNotifications,
      markNotificationRead: (id) => dispatch({ type: 'notifications/read', id }),
      markAllNotificationsRead: () => dispatch({ type: 'notifications/readAll' }),
      clearNotifications: () => dispatch({ type: 'notifications/clear' }),
      updateSettings: (patch) => dispatch({ type: 'settings/update', patch }),
      replaceData: (data) => dispatch({ type: 'data/replace', data }),
      resetToSampleData: () =>
        dispatch({ type: 'data/replace', data: { ...createSampleData(), settings: stateRef.current.settings } }),
      clearAllData: () => dispatch({ type: 'data/replace', data: createEmptyData(stateRef.current.settings) }),
    }),
    // Every callback above is stable, so this object keeps its identity for the app's lifetime.
    [createTask, createTasks, updateTask, moveTask, setStatus, toggleComplete, updateNotes, discardTask, bulkUpdate, bulkDelete, restoreTasks, deleteTask, restoreTask, duplicateTask, toggleSubtask, addSubtask, removeSubtask, createProject, updateProject, deleteProject, addNotifications],
  );

  const dataState = useMemo<DataState>(() => ({ ...state, storageError }), [state, storageError]);

  return (
    <DataActionsContext.Provider value={actions}>
      <DataStateContext.Provider value={dataState}>{children}</DataStateContext.Provider>
    </DataActionsContext.Provider>
  );
}

/** Stable action functions. Components that only use this skip re-rendering when data changes. */
export function useDataActions(): DataActions {
  const ctx = useContext(DataActionsContext);
  if (!ctx) throw new Error('useDataActions must be used inside <DataProvider>');
  return ctx;
}

export function useDataState(): DataState {
  const ctx = useContext(DataStateContext);
  if (!ctx) throw new Error('useDataState must be used inside <DataProvider>');
  return ctx;
}

/** State and actions together, for components that need both. */
export function useData(): DataApi {
  const state = useDataState();
  const actions = useDataActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
