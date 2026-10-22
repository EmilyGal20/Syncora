// @ts-nocheck
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TaskFilters, TaskInput, TaskSort } from '../types';
import { DEFAULT_FILTERS, SORT_OPTIONS, sanitizeFilters } from '../lib/tasks';
import { useNow } from '../hooks/useNow';
import { useDataState } from './DataContext';

export type Route =
  | { name: 'dashboard' }
  | { name: 'tasks' }
  | { name: 'planner' }
  | { name: 'board' }
  | { name: 'calendar' }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'analytics' }
  | { name: 'settings' };

const SIMPLE_ROUTES = ['dashboard', 'tasks', 'planner', 'board', 'calendar', 'projects', 'analytics', 'settings'] as const;

function parseHash(hash: string): Route {
  const [name, id] = hash.replace(/^#\/?/, '').split('/');
  if (name === 'projects' && id) return { name: 'project', id: decodeURIComponent(id) };
  return (SIMPLE_ROUTES as readonly string[]).includes(name) ? ({ name } as Route) : { name: 'dashboard' };
}

export function parseFlowPath(pathname: string): Route {
  const rest = pathname.replace(/^\/flow\/?/, '');
  const [name, id] = rest.split('/');
  if (name === 'projects' && id) return { name: 'project', id: decodeURIComponent(id) };
  return (SIMPLE_ROUTES as readonly string[]).includes(name) ? ({ name } as Route) : { name: 'dashboard' };
}

export function routeToHash(route: Route): string {
  return route.name === 'project' ? `#/projects/${encodeURIComponent(route.id)}` : `#/${route.name}`;
}

export function routeToFlowPath(route: Route): string {
  return route.name === 'project' ? `/flow/projects/${encodeURIComponent(route.id)}` : `/flow/${route.name}`;
}

/** `session` changes on every open so a dialog reopened mid-close never reuses stale form state. */
type TaskFormState = { open: false } | { open: true; session: number; taskId?: string; defaults?: Partial<TaskInput> };
type ProjectFormState = { open: false } | { open: true; session: number; projectId?: string };
let formSession = 0;

export interface UIState {
  route: Route;
  embedded: boolean;
  isDark: boolean;
  filters: TaskFilters;
  sort: TaskSort;
  taskForm: TaskFormState;
  detailTaskId: string | null;
  projectForm: ProjectFormState;
  paletteOpen: boolean;
  shortcutsOpen: boolean;
  mobileNavOpen: boolean;
  sidebarCollapsed: boolean;
  /** Tasks selected for bulk actions. */
  selectedIds: string[];
}

/** Stable setters and commands; their identity never changes. */
export interface UIActions {
  /** Latest UI state without subscribing to changes. */
  getUIState: () => UIState;
  navigate: (route: Route) => void;
  setFilters: (patch: Partial<TaskFilters>) => void;
  resetFilters: () => void;
  setSort: (sort: TaskSort) => void;
  openTaskForm: (opts?: { taskId?: string; defaults?: Partial<TaskInput> }) => void;
  closeTaskForm: () => void;
  openTaskDetail: (id: string) => void;
  closeTaskDetail: () => void;
  openProjectForm: (projectId?: string) => void;
  closeProjectForm: () => void;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSelected: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
}

export type UIApi = UIState & UIActions & { now: Date };

const UIStateContext = createContext<UIState | null>(null);
const UIActionsContext = createContext<UIActions | null>(null);
const NowContext = createContext<Date | null>(null);

const PREFS_KEY = 'taskflow:ui-prefs';

interface Prefs {
  filters: TaskFilters;
  sort: TaskSort;
  sidebarCollapsed: boolean;
}

/** View preferences are a per-browser convenience; failures fall back to defaults silently. */
function loadPrefs(): Prefs {
  const fallback: Prefs = { filters: DEFAULT_FILTERS, sort: { key: 'dueDate', reversed: false }, sidebarCollapsed: false };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    const sortKey = SORT_OPTIONS.some((o) => o.key === raw.sort?.key) ? raw.sort.key : fallback.sort.key;
    return {
      filters: sanitizeFilters(raw.filters),
      sort: { key: sortKey, reversed: raw.sort?.reversed === true },
      sidebarCollapsed: raw.sidebarCollapsed === true,
    };
  } catch {
    return fallback;
  }
}

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

export function UIProvider({
  children,
  pathname,
  onNavigate,
  embedded = false,
}: {
  children: ReactNode;
  pathname?: string;
  onNavigate?: (path: string) => void;
  embedded?: boolean;
}) {
  const { settings } = useDataState();
  const now = useNow();
  const [prefs] = useState(loadPrefs);
  const [route, setRoute] = useState<Route>(() => (pathname ? parseFlowPath(pathname) : parseHash(window.location.hash)));
  const [filters, setFiltersState] = useState<TaskFilters>(prefs.filters);
  const [sort, setSort] = useState<TaskSort>(prefs.sort);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(prefs.sidebarCollapsed);
  const [taskForm, setTaskForm] = useState<TaskFormState>({ open: false });
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>({ open: false });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const systemDark = useSystemDark();
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  useEffect(() => {
    const root = document.getElementById('taskflow-root');
    root?.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (pathname) setRoute(parseFlowPath(pathname));
  }, [pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ filters, sort, sidebarCollapsed }));
    } catch {
      /* preferences are optional */
    }
  }, [filters, sort, sidebarCollapsed]);

  useEffect(() => {
    if (onNavigate) return;
    const onHash = () => {
      setRoute(parseHash(window.location.hash));
      setMobileNavOpen(false);
      setSelectedIds([]);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [onNavigate]);

  const state = useMemo<UIState>(
    () => ({
      route,
      embedded,
      isDark,
      filters,
      sort,
      taskForm,
      detailTaskId,
      projectForm,
      paletteOpen,
      shortcutsOpen,
      mobileNavOpen,
      sidebarCollapsed,
      selectedIds,
    }),
    [route, embedded, isDark, filters, sort, taskForm, detailTaskId, projectForm, paletteOpen, shortcutsOpen, mobileNavOpen, sidebarCollapsed, selectedIds],
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const navigate = useCallback(
    (next: Route) => {
      if (onNavigate) onNavigate(routeToFlowPath(next));
      else {
        const hash = routeToHash(next);
        if (window.location.hash !== hash) window.location.hash = hash;
      }
      setRoute(next);
      setMobileNavOpen(false);
    },
    [onNavigate],
  );

  const actions = useMemo<UIActions>(
    () => ({
      getUIState: () => stateRef.current,
      navigate,
      setFilters: (patch) => setFiltersState((f) => ({ ...f, ...patch })),
      resetFilters: () => setFiltersState(DEFAULT_FILTERS),
      setSort,
      openTaskForm: (opts = {}) => setTaskForm({ open: true, session: ++formSession, ...opts }),
      closeTaskForm: () => setTaskForm({ open: false }),
      openTaskDetail: setDetailTaskId,
      closeTaskDetail: () => setDetailTaskId(null),
      openProjectForm: (projectId) => setProjectForm({ open: true, session: ++formSession, projectId }),
      closeProjectForm: () => setProjectForm({ open: false }),
      setPaletteOpen,
      setShortcutsOpen,
      setMobileNavOpen,
      toggleSidebar: () => setSidebarCollapsed((c) => !c),
      toggleSelected: (id) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
      setSelectedIds,
      clearSelection: () => setSelectedIds((ids) => (ids.length ? [] : ids)),
    }),
    [navigate],
  );

  return (
    <UIActionsContext.Provider value={actions}>
      <NowContext.Provider value={now}>
        <UIStateContext.Provider value={state}>{children}</UIStateContext.Provider>
      </NowContext.Provider>
    </UIActionsContext.Provider>
  );
}

export function useUIActions(): UIActions {
  const ctx = useContext(UIActionsContext);
  if (!ctx) throw new Error('useUIActions must be used inside <UIProvider>');
  return ctx;
}

export function useUIState(): UIState {
  const ctx = useContext(UIStateContext);
  if (!ctx) throw new Error('useUIState must be used inside <UIProvider>');
  return ctx;
}

/** The app clock, refreshed every minute. */
export function useClock(): Date {
  const ctx = useContext(NowContext);
  if (!ctx) throw new Error('useClock must be used inside <UIProvider>');
  return ctx;
}

/** Everything together, for components that need several pieces. */
export function useUI(): UIApi {
  const state = useUIState();
  const actions = useUIActions();
  const now = useClock();
  return useMemo(() => ({ ...state, ...actions, now }), [state, actions, now]);
}
