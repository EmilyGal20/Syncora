// @ts-nocheck
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CalendarCheck2, Flame, Timer, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { useDataState } from '../store/DataContext';
import { useClock, useUIActions, useUIState } from '../store/UIContext';
import {
  averageCompletionHours,
  completionHeatmap,
  completionStreak,
  completionsByHour,
  completionsByWeekday,
  dailySeries,
  formatDuration,
  getOverview,
  longestStreak,
  rangeSummary,
  tasksByPriority,
  tasksByProject,
  tasksByStatus,
  weeklySeries,
  type HeatCell,
} from '../lib/stats';
import { parseISODate } from '../lib/date';
import { cn, percent, pluralize } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Segmented } from '../components/ui/Controls';
import { ProgressBar } from '../components/ui/Progress';
import { EmptyState } from '../components/ui/EmptyState';
import { CardHeader, ChartTooltip, Legend, axisProps, chartTheme } from '../components/ui/ChartKit';

type Range = '7' | '30' | '90';
const RANGE_LABEL: Record<Range, string> = { '7': 'last 7 days', '30': 'last 30 days', '90': 'last 90 days' };
const HEATMAP_WEEKS = 18;

export function AnalyticsPage() {
  const { tasks, projects, settings } = useDataState();
  const { isDark } = useUIState();
  const { openTaskForm } = useUIActions();
  const now = useClock();
  const theme = chartTheme(isDark);
  const [range, setRange] = useState<Range>('30');
  const days = Number(range);

  const stats = useMemo(
    () => ({
      overview: getOverview(tasks, now, settings.dailyGoal),
      streak: completionStreak(tasks, now),
      longest: longestStreak(tasks),
      avgHours: averageCompletionHours(tasks),
      weekly: weeklySeries(tasks, now, 8, settings.weekStartsOn),
      priority: tasksByPriority(tasks),
      byProject: tasksByProject(tasks, projects, now),
      status: tasksByStatus(tasks),
      weekday: completionsByWeekday(tasks, settings.weekStartsOn),
      hours: completionsByHour(tasks),
      heatmap: completionHeatmap(tasks, now, HEATMAP_WEEKS, settings.weekStartsOn),
    }),
    [tasks, projects, now, settings.dailyGoal, settings.weekStartsOn],
  );
  const summary = useMemo(() => rangeSummary(tasks, now, days), [tasks, now, days]);
  const flow = useMemo(() => dailySeries(tasks, now, days), [tasks, now, days]);

  if (tasks.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" description="Insights calculated from your tasks." />
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="No data to analyze yet"
            description="Create and complete a few tasks — your productivity insights will appear here."
            action={
              <button className="btn-primary" onClick={() => openTaskForm()}>
                Create a task
              </button>
            }
          />
        </div>
      </>
    );
  }

  const trendUp = summary.change >= 0;
  const bestDay = stats.weekday.reduce((best, d) => (d.completed > best.completed ? d : best), stats.weekday[0]);
  const peakHour = stats.hours.reduce((best, h) => (h.completed > best.completed ? h : best), stats.hours[0]);
  const activeHours = stats.hours.filter((h) => h.hour >= 6 && h.hour <= 22);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Every number here is calculated live from your tasks."
        actions={
          <Segmented
            label="Date range"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          label="Completed"
          value={summary.completed}
          icon={Trophy}
          tone="violet"
          hint={
            <span className={cn('inline-flex items-center gap-1 font-medium', trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {trendUp ? '+' : ''}
              {summary.change}% vs previous {days} days
            </span>
          }
        />
        <StatCard
          index={1}
          label="On-time rate"
          value={summary.onTimeRate === null ? '—' : `${summary.onTimeRate}%`}
          icon={CalendarCheck2}
          tone="emerald"
          hint={summary.onTimeSample ? `${pluralize(summary.onTimeSample, 'task')} with a deadline` : `No deadlines met in the ${RANGE_LABEL[range]}`}
        />
        <StatCard
          index={2}
          label="Current streak"
          value={pluralize(stats.streak, 'day')}
          icon={Flame}
          tone="amber"
          hint={`Longest: ${pluralize(stats.longest, 'day')}`}
        />
        <StatCard
          index={3}
          label="Avg. time to complete"
          value={stats.avgHours === null ? '—' : formatDuration(stats.avgHours)}
          icon={Timer}
          tone="sky"
          hint={`${summary.perDay} completed per day on average`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card p-5 sm:p-6 xl:col-span-2">
          <CardHeader
            title="Created vs completed"
            subtitle={`${summary.created} created · ${summary.completed} completed in the ${RANGE_LABEL[range]}`}
            action={<Legend items={[{ label: 'Completed', color: theme.primary }, { label: 'Created', color: theme.secondary }]} />}
          />
          <div className="h-64" role="img" aria-label={`Tasks created and completed per day over the ${RANGE_LABEL[range]}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flow} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="flowDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.primary} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={theme.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis dataKey="label" {...axisProps(isDark)} interval="preserveStartEnd" minTickGap={28} />
                <YAxis allowDecimals={false} width={28} {...axisProps(isDark)} />
                <Tooltip cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }} content={<ChartTooltip labelKey="fullLabel" />} />
                <Area type="monotone" dataKey="created" name="Created" stroke={theme.secondary} strokeWidth={2} fill="none" strokeDasharray="4 3" dot={false} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke={theme.primary}
                  strokeWidth={2}
                  fill="url(#flowDone)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: theme.surface }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <CardHeader title="Tasks by priority" subtitle={`${stats.overview.total} tasks total`} />
          <div className="relative mx-auto h-40 w-40" role="img" aria-label={`Donut chart: ${stats.priority.map((p) => `${p.label} ${p.total}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.priority.filter((p) => p.total > 0)}
                  dataKey="total"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke={theme.surface}
                  strokeWidth={2}
                  cornerRadius={4}
                >
                  {stats.priority
                    .filter((p) => p.total > 0)
                    .map((p) => (
                      <Cell key={p.priority} fill={p.color} />
                    ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{stats.overview.total - stats.overview.completed}</div>
                <div className="text-[11px] text-slate-500">open</div>
              </div>
            </div>
          </div>
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="pb-2 font-semibold">Priority</th>
                <th className="pb-2 text-right font-semibold">Open</th>
                <th className="pb-2 text-right font-semibold">Done</th>
                <th className="pb-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.priority.map((p) => (
                <tr key={p.priority} className="border-t border-slate-100 dark:border-white/[0.05]">
                  <td className="py-2">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{p.open}</td>
                  <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{p.completed}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-3">
          <CardHeader
            title="Completion activity"
            subtitle={`Tasks completed per day over the last ${HEATMAP_WEEKS} weeks`}
            action={<HeatLegend />}
          />
          <Heatmap grid={stats.heatmap} />
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-2">
          <CardHeader title="Weekly productivity" subtitle="Tasks completed per week, last 8 weeks" />
          <div className="h-56" role="img" aria-label={`Bar chart of tasks completed per week: ${stats.weekly.map((w) => `${w.label} ${w.completed}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekly} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis dataKey="label" {...axisProps(isDark)} />
                <YAxis allowDecimals={false} width={28} {...axisProps(isDark)} />
                <Tooltip cursor={{ fill: theme.cursor, radius: 8 }} content={<ChartTooltip />} />
                <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {stats.weekly.map((w, i) => (
                    <Cell key={w.label} fill={theme.primary} fillOpacity={i === stats.weekly.length - 1 ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <CardHeader title="Status breakdown" subtitle="Where your tasks are right now" />
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={stats.status.map((s) => `${s.label}: ${s.value}`).join(', ')}>
            {stats.status.map((s) =>
              s.value > 0 ? <div key={s.status} style={{ width: `${percent(s.value, stats.overview.total)}%`, backgroundColor: s.color }} /> : null,
            )}
          </div>
          <ul className="mt-5 space-y-3">
            {stats.status.map((s) => (
              <li key={s.status} className="flex items-center gap-3 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-slate-700 dark:text-slate-300">{s.label}</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{s.value}</span>
                <span className="w-10 text-right text-xs tabular-nums text-slate-400">{percent(s.value, stats.overview.total)}%</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-[13px] dark:border-white/[0.06]">
            <div>
              <p className="text-xs text-slate-500">Overdue now</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{stats.overview.overdue}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Completion rate</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{stats.overview.completionRate}%</p>
            </div>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <CardHeader
            title="By weekday"
            subtitle={bestDay.completed > 0 ? `Most productive: ${bestDay.label}` : 'No completions yet'}
          />
          <div className="h-40" role="img" aria-label={`Completions by weekday. ${stats.weekday.map((d) => `${d.label} ${d.completed}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekday} barCategoryGap="25%">
                <XAxis dataKey="label" {...axisProps(isDark)} tick={{ fill: theme.axis, fontSize: 11 }} />
                <Tooltip cursor={{ fill: theme.cursor, radius: 6 }} content={<ChartTooltip />} />
                <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]}>
                  {stats.weekday.map((d) => (
                    <Cell key={d.label} fill={theme.primary} fillOpacity={d === bestDay && d.completed > 0 ? 1 : 0.45} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-2">
          <CardHeader
            title="Time of day"
            subtitle={peakHour.completed > 0 ? `You finish the most around ${peakHour.label}` : 'No completions yet'}
          />
          <div className="h-40" role="img" aria-label={`Completions by hour of day. Peak: ${peakHour.label}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeHours} barCategoryGap="20%">
                <XAxis dataKey="label" {...axisProps(isDark)} tick={{ fill: theme.axis, fontSize: 11 }} interval={1} />
                <Tooltip cursor={{ fill: theme.cursor, radius: 6 }} content={<ChartTooltip />} />
                <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]}>
                  {activeHours.map((h) => (
                    <Cell key={h.hour} fill={theme.secondary} fillOpacity={h === peakHour && h.completed > 0 ? 1 : 0.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 sm:p-6 xl:col-span-3">
          <CardHeader title="Tasks by project" subtitle="Completion rate per project" />
          {stats.byProject.length === 0 ? (
            <p className="text-sm text-slate-500">No projects yet.</p>
          ) : (
            <ul className="grid gap-x-10 gap-y-5 md:grid-cols-2">
              {stats.byProject.map((p) => (
                <li key={p.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ backgroundColor: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {p.completed}/{p.total} done
                      {p.overdue > 0 && <span className="ml-2 text-rose-600 dark:text-rose-400">{p.overdue} overdue</span>}
                      <span className="ml-2 font-semibold tabular-nums text-slate-900 dark:text-white">{p.progress}%</span>
                    </span>
                  </div>
                  <ProgressBar value={p.progress} color={p.color} label={`${p.name} completion`} className="h-2" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/** Single-hue sequential ramp; level 0 is the empty-day tile. */
const HEAT_CLASSES: Record<HeatCell['level'], string> = {
  0: 'bg-slate-100 dark:bg-white/[0.05]',
  1: 'bg-violet-200 dark:bg-violet-900/80',
  2: 'bg-violet-400 dark:bg-violet-700',
  3: 'bg-violet-600 dark:bg-violet-500',
  4: 'bg-violet-800 dark:bg-violet-300',
};

function HeatLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500" aria-hidden>
      Less
      {([0, 1, 2, 3, 4] as const).map((l) => (
        <span key={l} className={cn('h-3 w-3 rounded-[3px]', HEAT_CLASSES[l])} />
      ))}
      More
    </div>
  );
}

function Heatmap({ grid }: { grid: HeatCell[][] }) {
  const months = grid.map((week, i) => {
    const first = parseISODate(week[0].date);
    const prev = i > 0 ? parseISODate(grid[i - 1][0].date) : null;
    return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleDateString(undefined, { month: 'short' }) : '';
  });
  const total = grid.flat().reduce((s, c) => s + c.count, 0);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex min-w-full flex-col gap-1" role="img" aria-label={`${total} tasks completed in the last ${grid.length} weeks`}>
        <div className="flex gap-1 pl-0 text-[10px] text-slate-400">
          {months.map((m, i) => (
            <span key={i} className="w-3.5 shrink-0 overflow-visible whitespace-nowrap sm:w-4">
              {m}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {grid.map((week) => (
            <div key={week[0].date} className="flex flex-col gap-1">
              {week.map((cell) => (
                <span
                  key={cell.date}
                  title={cell.future ? '' : `${parseISODate(cell.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${pluralize(cell.count, 'task')}`}
                  className={cn('h-3.5 w-3.5 rounded-[3px] sm:h-4 sm:w-4', cell.future ? 'bg-transparent' : HEAT_CLASSES[cell.level])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
