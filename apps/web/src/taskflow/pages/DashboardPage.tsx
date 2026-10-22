// @ts-nocheck
import { Suspense, lazy, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  CornerDownLeft,
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ActivityType, Task } from '../types';
import { useData } from '../store/DataContext';
import { useUI } from '../store/UIContext';
import { currentWeekSeries, getOverview, productivityTrend, projectStats, weekComparison } from '../lib/stats';
import { addDays, diffInDays, formatDueLabel, formatLongDate, greeting, parseISODate, relativeTime, toISODate } from '../lib/date';
import { PRIORITY_META, dueDateTime, isDueOn, isOverdue, sortTasks } from '../lib/tasks';
import { cn, pluralize } from '../lib/utils';
import { useTaskActions } from '../hooks/useTaskActions';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar, ProgressRing } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { CardHeader, chartTheme } from '../components/ui/ChartKit';
import { Skeleton } from '../components/ui/Skeleton';

// Charts load separately so the rest of the dashboard appears immediately.
const WeekBars = lazy(() => import('../components/charts/DashboardCharts'));
const TrendArea = lazy(() => import('../components/charts/DashboardCharts').then((m) => ({ default: m.TrendArea })));
import { TaskRow } from '../components/tasks/TaskRow';
import { useToast } from '../components/ui/Toast';

const ACTIVITY_ICONS: Record<ActivityType, { icon: typeof Plus; className: string }> = {
  task_created: { icon: Plus, className: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
  task_updated: { icon: Pencil, className: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
  task_completed: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
  task_reopened: { icon: RotateCcw, className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300' },
  task_moved: { icon: ArrowRight, className: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' },
  task_deleted: { icon: Trash2, className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
  project_created: { icon: FolderPlus, className: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300' },
  project_updated: { icon: Pencil, className: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
  project_deleted: { icon: Trash2, className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
};

const PRIORITY_LIMIT = 6;

export function DashboardPage() {
  const { tasks, projects, activity, settings } = useData();
  const { now, isDark, navigate, openTaskDetail, setFilters, resetFilters } = useUI();
  const actions = useTaskActions();
  const theme = chartTheme(isDark);

  const overview = useMemo(() => getOverview(tasks, now, settings.dailyGoal), [tasks, now, settings.dailyGoal]);
  const week = useMemo(() => currentWeekSeries(tasks, now, settings.weekStartsOn), [tasks, now, settings.weekStartsOn]);
  const weekVs = useMemo(() => weekComparison(tasks, now, settings.weekStartsOn), [tasks, now, settings.weekStartsOn]);
  const trend = useMemo(() => productivityTrend(tasks, now, 14), [tasks, now]);

  const overdue = useMemo(() => sortTasks(tasks.filter((t) => isOverdue(t, now)), { key: 'priority', reversed: false }), [tasks, now]);
  const dueTodayOpen = useMemo(() => tasks.filter((t) => t.status !== 'done' && isDueOn(t, now) && !isOverdue(t, now)), [tasks, now]);

  // Today's priorities: everything overdue or due today, most important first.
  const priorities = useMemo(
    () => sortTasks([...overdue, ...dueTodayOpen], { key: 'priority', reversed: false }),
    [overdue, dueTodayOpen],
  );
  const completedToday = useMemo(
    () => tasks.filter((t) => t.completedAt && diffInDays(new Date(t.completedAt), now) === 0),
    [tasks, now],
  );

  const upcoming = useMemo(() => {
    const horizon = addDays(now, 7);
    return sortTasks(
      tasks.filter((t) => {
        const due = dueDateTime(t);
        return t.status !== 'done' && due !== null && !isDueOn(t, now) && due > now && due <= horizon;
      }),
      { key: 'dueDate', reversed: false },
    ).slice(0, 5);
  }, [tasks, now]);

  const showTasks = (status: 'all' | 'open' | 'done' | 'in_progress' | 'overdue') => {
    resetFilters();
    setFilters({ status });
    navigate({ name: 'tasks' });
  };

  const projectOf = (t: Task) => projects.find((p) => p.id === t.projectId);
  const openCount = overview.total - overview.completed;

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-4 w-4" /> {formatLongDate(now)}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px] dark:text-white">
            {greeting(now)}, {settings.userName}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {priorities.length === 0
              ? 'Nothing urgent on your plate today. A good moment to plan ahead.'
              : `${pluralize(priorities.length, 'priority', 'priorities')} today${overdue.length ? `, including ${overdue.length} overdue` : ''}. ${
                  completedToday.length ? `${completedToday.length} done so far.` : "Let's get started."
                }`}
          </p>
        </div>
        <QuickAdd />
      </motion.header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Completed today"
          value={
            <span>
              {overview.completedToday}
              <span className="ml-1 text-base font-semibold text-slate-400">/ {settings.dailyGoal}</span>
            </span>
          }
          icon={CircleCheckBig}
          tone="emerald"
          hint={<ProgressBar value={overview.goalProgress} color="#10b981" label="Daily goal progress" />}
        />
        <StatCard
          index={1}
          label="Due today"
          value={dueTodayOpen.length}
          icon={Target}
          tone="violet"
          hint={`${pluralize(openCount, 'open task')} in total`}
          onClick={() => showTasks('open')}
        />
        <StatCard
          index={2}
          label="Overdue"
          value={overdue.length}
          icon={AlertTriangle}
          tone="rose"
          hint={overdue.length ? 'Needs your attention' : 'You are all caught up'}
          onClick={() => showTasks('overdue')}
        />
        <StatCard
          index={3}
          label="Done this week"
          value={weekVs.thisWeek}
          icon={weekVs.change >= 0 ? TrendingUp : TrendingDown}
          tone="sky"
          hint={
            <span className={weekVs.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {weekVs.change >= 0 ? '+' : ''}
              {weekVs.change}% vs last week
            </span>
          }
          onClick={() => navigate({ name: 'analytics' })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <section className="card p-5 sm:p-6">
            <CardHeader
              title="Today's priorities"
              subtitle="Overdue and due-today tasks, most important first"
              action={
                priorities.length > PRIORITY_LIMIT ? (
                  <button className="btn-ghost btn-sm" onClick={() => showTasks('open')}>
                    View all {priorities.length} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : undefined
              }
            />
            {priorities.length === 0 ? (
              <EmptyState
                compact
                icon={Sparkles}
                title={completedToday.length ? 'Today’s list is done' : 'Your day is clear'}
                description={
                  completedToday.length
                    ? `You completed ${pluralize(completedToday.length, 'task')} today. Pull something forward from upcoming?`
                    : 'Nothing is due today. Use Quick add above to plan something.'
                }
              />
            ) : (
              <div className="-mx-3 divide-y divide-slate-100 dark:divide-white/[0.05]">
                <AnimatePresence initial={false} mode="popLayout">
                  {priorities.slice(0, PRIORITY_LIMIT).map((t) => (
                    <TaskRow key={t.id} task={t} project={projectOf(t)} />
                  ))}
                </AnimatePresence>
              </div>
            )}
            {completedToday.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-white/[0.06]">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Completed today:</span>
                {completedToday.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openTaskDetail(t.id)}
                    className="max-w-[180px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-slate-500 line-through hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    {t.title}
                  </button>
                ))}
                {completedToday.length > 4 && <span>+{completedToday.length - 4} more</span>}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="card p-5 sm:p-6">
              <CardHeader title="This week" subtitle={`${weekVs.thisWeek} completed · ${week.reduce((s, d) => s + d.due, 0)} due`} />
              <div className="h-48" role="img" aria-label={`Tasks completed each day this week: ${week.map((d) => `${d.label} ${d.completed}`).join(', ')}`}>
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <WeekBars data={week} isDark={isDark} />
                </Suspense>
              </div>
            </section>

            <section className="card p-5 sm:p-6">
              <CardHeader
                title="Productivity trend"
                subtitle={`${trend.recent} completed in the last 14 days`}
                action={
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                      trend.change >= 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
                    )}
                    title={`${trend.previous} in the 14 days before`}
                  >
                    {trend.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {trend.change >= 0 ? '+' : ''}
                    {trend.change}%
                  </span>
                }
              />
              <div className="h-48" role="img" aria-label={`Completions per day over the last 14 days, ${trend.change}% change versus the previous 14 days`}>
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <TrendArea data={trend.series} isDark={isDark} />
                </Suspense>
              </div>
            </section>
          </div>

          {projects.length > 0 && (
            <section className="card p-5 sm:p-6">
              <CardHeader
                title="Project progress"
                action={
                  <button className="btn-ghost btn-sm" onClick={() => navigate({ name: 'projects' })}>
                    All projects <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {projects.slice(0, 6).map((p) => {
                  const s = projectStats(p.id, tasks, now);
                  return (
                    <li key={p.id}>
                      <button className="group w-full text-left" onClick={() => navigate({ name: 'project', id: p.id })}>
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800 group-hover:text-violet-700 dark:text-slate-200 dark:group-hover:text-violet-300">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ backgroundColor: p.color }} />
                            <span className="truncate">{p.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {s.completed}/{s.total}
                            {s.overdue > 0 && <span className="ml-1.5 text-rose-600 dark:text-rose-400">· {s.overdue} overdue</span>}
                            <span className="ml-1.5 font-semibold text-slate-900 dark:text-white">{s.progress}%</span>
                          </span>
                        </div>
                        <ProgressBar value={s.progress} color={p.color} label={`${p.name} progress`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6">
            <CardHeader title="Daily focus" subtitle="Share of today's tasks completed" />
            <div className="flex items-center gap-5">
              <ProgressRing value={overview.productivity} size={108} stroke={10} color={theme.primary} label="Daily productivity">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{overview.productivity}%</div>
                  <div className="text-[11px] text-slate-500">today</div>
                </div>
              </ProgressRing>
              <dl className="min-w-0 flex-1 space-y-2.5 text-[13px]">
                <Metric label="Today's tasks" value={`${overview.todayDone}/${overview.todayTotal}`} />
                <Metric label="Daily goal" value={`${overview.completedToday}/${settings.dailyGoal}`} />
                <Metric label="In progress" value={overview.inProgress} />
                <Metric label="Completion rate" value={`${overview.completionRate}%`} />
              </dl>
            </div>
          </section>

          {overdue.length > 0 && (
            <section className="card border-rose-200/70 p-5 sm:p-6 dark:border-rose-500/20">
              <CardHeader
                title="Overdue"
                subtitle={pluralize(overdue.length, 'task') + ' past due'}
                action={
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => actions.bulkUpdate(overdue.map((t) => t.id), { dueDate: toISODate(now), dueTime: null }, 'moved to today')}
                  >
                    Move all to today
                  </button>
                }
              />
              <ul className="space-y-1">
                {overdue.slice(0, 4).map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => openTaskDetail(t.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-rose-50/60 dark:hover:bg-rose-500/[0.06]"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_META[t.priority].color }} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">{t.title}</span>
                      <span className="shrink-0 text-xs font-medium text-rose-600 dark:text-rose-400">
                        {formatDueLabel(t.dueDate!, t.dueTime, now)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {overdue.length > 4 && (
                <button className="mt-2 px-2 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400" onClick={() => showTasks('overdue')}>
                  View all {overdue.length} overdue
                </button>
              )}
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <CardHeader
              title="Upcoming deadlines"
              subtitle="Next 7 days"
              action={
                <button className="btn-ghost btn-sm" onClick={() => navigate({ name: 'calendar' })}>
                  Calendar <ArrowRight className="h-3.5 w-3.5" />
                </button>
              }
            />
            {upcoming.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title="No upcoming deadlines" description="Tasks due in the next week will show up here." />
            ) : (
              <ul className="space-y-1">
                {upcoming.map((t) => {
                  const project = projectOf(t);
                  const due = parseISODate(t.dueDate!);
                  const days = diffInDays(due, now);
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => openTaskDetail(t.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                      >
                        <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-100 dark:bg-white/[0.04] dark:ring-white/[0.06]">
                          <span className="text-[9px] font-semibold uppercase leading-none text-slate-400">
                            {due.toLocaleDateString(undefined, { month: 'short' })}
                          </span>
                          <span className="mt-0.5 text-sm font-bold leading-none text-slate-900 dark:text-white">{due.getDate()}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">{t.title}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_META[t.priority].color }} />
                            <span className="truncate">
                              {formatDueLabel(t.dueDate!, t.dueTime, now)}
                              {project && ` · ${project.name}`}
                            </span>
                          </span>
                        </span>
                        <span className={cn('shrink-0 text-xs font-medium', days <= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')}>
                          {days === 1 ? 'in 1 day' : `in ${days} days`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <CardHeader title="Recent activity" />
            {activity.length === 0 ? (
              <EmptyState compact icon={ActivityIcon} title="No activity yet" description="Your changes will be tracked here." />
            ) : (
              <ol className="space-y-3">
                {activity.slice(0, 6).map((a) => {
                  const meta = ACTIVITY_ICONS[a.type] ?? ACTIVITY_ICONS.task_updated;
                  const clickable = a.taskId && tasks.some((t) => t.id === a.taskId);
                  return (
                    <li key={a.id} className="flex items-start gap-3">
                      <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', meta.className)}>
                        <meta.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {clickable ? (
                          <button
                            onClick={() => openTaskDetail(a.taskId!)}
                            className="block max-w-full truncate text-left text-[13px] text-slate-700 hover:text-violet-600 dark:text-slate-300 dark:hover:text-violet-300"
                          >
                            {a.message}
                          </button>
                        ) : (
                          <p className="truncate text-[13px] text-slate-700 dark:text-slate-300">{a.message}</p>
                        )}
                        <p className="text-[11px] text-slate-400">{relativeTime(a.at, now)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

/** Inline quick-add: type a title and press Enter. Due today by default. */
function QuickAdd() {
  const { createTask } = useData();
  const { now, openTaskForm } = useUI();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [today, setToday] = useState(true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    createTask({
      title: clean.slice(0, 200),
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: today ? toISODate(now) : null,
      dueTime: null,
      projectId: null,
      category: null,
      tags: [],
      subtasks: [],
      notes: '',
      recurrence: null,
    });
    setTitle('');
    toast({ title: 'Task added', description: today ? `${clean} · due today` : clean });
  };

  return (
    <form onSubmit={submit} className="card flex w-full items-center gap-2 p-1.5 pl-3 lg:max-w-md">
      <Plus className="h-4 w-4 shrink-0 text-violet-500" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Quick add a task…"
        aria-label="Quick add a task"
        maxLength={200}
        className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
      />
      <button
        type="button"
        onClick={() => setToday((v) => !v)}
        aria-pressed={today}
        title="Toggle due today"
        className={cn(
          'h-7 shrink-0 rounded-lg px-2 text-xs font-medium transition',
          today ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5',
        )}
      >
        Today
      </button>
      {title.trim() ? (
        <button type="submit" className="btn-primary btn-sm shrink-0" aria-label="Add task">
          <CornerDownLeft className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => openTaskForm({ defaults: today ? { dueDate: toISODate(now) } : {} })}>
          Details
        </button>
      )}
    </form>
  );
}
