// @ts-nocheck
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarDays,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useDataState } from '../../store/DataContext';
import { useClock, useUIActions, useUIState, type Route } from '../../store/UIContext';
import { cn } from '../../lib/utils';
import { isSameDay } from '../../lib/date';
import { ProgressBar, ProgressRing } from '../ui/Progress';

interface NavItem {
  name: Exclude<Route['name'], 'project'>;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D' },
  { name: 'tasks', label: 'My Tasks', icon: ListTodo, shortcut: 'G T' },
  { name: 'planner', label: 'AI Planner', icon: Sparkles, shortcut: 'G I' },
  { name: 'board', label: 'Board', icon: Columns3, shortcut: 'G B' },
  { name: 'calendar', label: 'Calendar', icon: CalendarDays, shortcut: 'G C' },
  { name: 'projects', label: 'Projects', icon: FolderKanban, shortcut: 'G P' },
  { name: 'analytics', label: 'Analytics', icon: BarChart3, shortcut: 'G A' },
];

export function LogoMark() {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-violet-600 shadow-sm shadow-violet-600/30">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">TaskFlow</span>
    </div>
  );
}

const itemBase =
  'relative flex h-9 w-full items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50';
const itemIdle =
  'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-slate-100';

export function SidebarContent({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { tasks, projects, settings } = useDataState();
  const { route, sidebarCollapsed } = useUIState();
  const { navigate, openTaskForm, openProjectForm, setPaletteOpen, toggleSidebar } = useUIActions();
  const now = useClock();
  // The mobile drawer is always full width.
  const collapsed = variant === 'desktop' && sidebarCollapsed;

  const { openCount, openByProject, completedToday } = useMemo(() => {
    const byProject = new Map<string, number>();
    let open = 0;
    let doneToday = 0;
    for (const t of tasks) {
      if (t.status !== 'done') {
        open++;
        if (t.projectId) byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + 1);
      } else if (t.completedAt && isSameDay(new Date(t.completedAt), now)) {
        doneToday++;
      }
    }
    return { openCount: open, openByProject: byProject, completedToday: doneToday };
  }, [tasks, now]);
  const goalProgress = Math.min(100, (completedToday / Math.max(1, settings.dailyGoal)) * 100);
  const initials = settings.userName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isActive = (name: string) => route.name === name || (name === 'projects' && route.name === 'project');

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <button
          onClick={() => navigate({ name: 'dashboard' })}
          aria-label="TaskFlow home"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        >
          {collapsed ? <LogoMark /> : <Logo />}
        </button>
        {variant === 'desktop' && !collapsed && (
          <button className="btn-icon h-8 w-8" onClick={toggleSidebar} aria-label="Collapse sidebar" title="Collapse sidebar ( [ )">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn('space-y-1.5 pb-2', collapsed ? 'px-2' : 'px-3')}>
        <button
          onClick={() => openTaskForm()}
          className={cn('btn-primary h-9 w-full', collapsed ? 'px-0' : 'justify-start')}
          aria-label="New task"
          title={collapsed ? 'New task (N)' : undefined}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && (
            <>
              New task
              <kbd className="ml-auto rounded-md bg-white/20 px-1.5 text-[11px] font-semibold">N</kbd>
            </>
          )}
        </button>
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
          title={collapsed ? 'Search (Ctrl K)' : undefined}
          className={cn(itemBase, itemIdle, collapsed ? 'justify-center' : 'gap-3 px-3')}
        >
          <Search className="h-[18px] w-[18px]" />
          {!collapsed && (
            <>
              Search
              <span className="ml-auto flex gap-0.5">
                <kbd className="kbd">Ctrl</kbd>
                <kbd className="kbd">K</kbd>
              </span>
            </>
          )}
        </button>
      </div>

      <nav className={cn('flex-1 overflow-y-auto py-2', collapsed ? 'px-2' : 'px-3')} aria-label="Main navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.name);
            return (
              <li key={item.name}>
                <button
                  onClick={() => navigate({ name: item.name })}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={`${item.label} (${item.shortcut})`}
                  className={cn(itemBase, collapsed ? 'justify-center' : 'gap-3 px-3', active ? 'text-violet-700 dark:text-white' : itemIdle)}
                >
                  {active && (
                    <motion.span
                      layoutId={`nav-active-${variant}`}
                      className="absolute inset-0 rounded-xl bg-violet-50 ring-1 ring-violet-100 dark:bg-violet-500/15 dark:ring-violet-400/20"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <item.icon className="relative h-[18px] w-[18px]" />
                  {!collapsed && <span className="relative">{item.label}</span>}
                  {item.name === 'tasks' && openCount > 0 && !collapsed && (
                    <span className="relative ml-auto rounded-md bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {openCount}
                    </span>
                  )}
                  {item.name === 'tasks' && openCount > 0 && collapsed && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-slate-200 dark:bg-white/10" />
          ) : (
            <div className="mb-1 flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Projects</span>
              <button onClick={() => openProjectForm()} className="btn-icon h-6 w-6 rounded-md" aria-label="Create project" title="New project">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {projects.length === 0 && !collapsed ? (
            <button onClick={() => openProjectForm()} className="w-full rounded-xl px-3 py-2 text-left text-[13px] text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04]">
              Create your first project
            </button>
          ) : (
            <ul className="space-y-0.5">
              {projects.map((p) => {
                const active = route.name === 'project' && route.id === p.id;
                const open = openByProject.get(p.id) ?? 0;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate({ name: 'project', id: p.id })}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? p.name : undefined}
                      title={collapsed ? `${p.name}${open ? ` · ${open} open` : ''}` : undefined}
                      className={cn(
                        'flex h-8 w-full items-center rounded-xl text-[13px] font-medium transition-colors',
                        collapsed ? 'justify-center' : 'gap-3 px-3',
                        active ? 'bg-slate-100 text-slate-900 dark:bg-white/[0.07] dark:text-white' : itemIdle,
                      )}
                    >
                      <span className={cn('shrink-0 rounded-[4px]', collapsed ? 'h-3 w-3' : 'h-2.5 w-2.5')} style={{ backgroundColor: p.color }} />
                      {!collapsed && <span className="truncate">{p.name}</span>}
                      {!collapsed && open > 0 && <span className="ml-auto text-[11px] tabular-nums text-slate-400">{open}</span>}
                    </button>
                  </li>
                );
              })}
              {collapsed && (
                <li>
                  <button
                    onClick={() => openProjectForm()}
                    className={cn('flex h-8 w-full items-center justify-center rounded-xl', itemIdle)}
                    aria-label="Create project"
                    title="New project"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </nav>

      <div className={cn('space-y-3 border-t border-slate-200/70 dark:border-white/[0.06]', collapsed ? 'p-2' : 'p-3')}>
        {collapsed ? (
          <div className="flex justify-center" title={`Daily goal: ${completedToday}/${settings.dailyGoal}`}>
            <ProgressRing value={goalProgress} size={36} stroke={4} label="Daily goal progress">
              <span className="text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{completedToday}</span>
            </ProgressRing>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/[0.06]">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">Daily goal</span>
              <span className="font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                {completedToday}/{settings.dailyGoal}
              </span>
            </div>
            <ProgressBar value={goalProgress} label="Daily goal progress" />
          </div>
        )}
        <button
          onClick={() => navigate({ name: 'settings' })}
          aria-current={route.name === 'settings' ? 'page' : undefined}
          aria-label={collapsed ? 'Settings' : undefined}
          title={collapsed ? `${settings.userName} · Settings` : undefined}
          className={cn(
            'flex w-full items-center rounded-xl p-2 text-left transition-colors hover:bg-slate-100/80 dark:hover:bg-white/[0.04]',
            collapsed ? 'justify-center' : 'gap-3',
            route.name === 'settings' && 'bg-slate-100 dark:bg-white/[0.06]',
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
            {initials || '?'}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{settings.userName}</span>
                <span className="block text-[11px] text-slate-500">Personal workspace</span>
              </span>
              <SettingsIcon className="h-4 w-4 text-slate-400" />
            </>
          )}
        </button>
        {collapsed && (
          <button className="btn-icon mx-auto flex h-8 w-8" onClick={toggleSidebar} aria-label="Expand sidebar" title="Expand sidebar ( [ )">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
