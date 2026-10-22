// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CalendarPlus, ChevronLeft, ChevronRight, Inbox, Plus, Repeat } from 'lucide-react';
import type { Task } from '../types';
import { useDataActions, useDataState } from '../store/DataContext';
import { useClock, useUIActions, useUIState } from '../store/UIContext';
import { addDays, addMonths, formatTime, isSameDay, monthGrid, toISODate, weekDays, weekdayLabels } from '../lib/date';
import { PRIORITY_META, filterTasks, isOverdue, sortTasks } from '../lib/tasks';
import { cn, pluralize } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { TaskToolbar, ViewSwitcher } from '../components/tasks/TaskToolbar';
import { TaskRow } from '../components/tasks/TaskRow';
import { Segmented } from '../components/ui/Controls';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

const DRAG_TYPE = 'application/x-taskflow-task';
const HOUR_HEIGHT = 48;
const SNAP_MINUTES = 30;
const MONTH_LIMIT = 3;

type DropTarget = { iso: string; minutes: number | null } | null;

const pad = (n: number) => String(n).padStart(2, '0');
const minutesToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function CalendarPage() {
  const { tasks, projects, settings } = useDataState();
  const { updateTask } = useDataActions();
  const { filters } = useUIState();
  const { openTaskForm } = useUIActions();
  const now = useClock();
  const toast = useToast();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [panel, setPanel] = useState<'day' | 'unscheduled'>('day');
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const weekStartsOn = settings.weekStartsOn;

  // After keyboard navigation re-renders the grid, move focus to the newly selected day.
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  });

  const visible = useMemo(() => filterTasks(tasks, filters, now, projects), [tasks, filters, now, projects]);
  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of sortTasks(visible, { key: 'dueDate', reversed: false })) {
      if (!t.dueDate) continue;
      map.set(t.dueDate, [...(map.get(t.dueDate) ?? []), t]);
    }
    return map;
  }, [visible]);
  const unscheduled = useMemo(
    () => sortTasks(visible.filter((t) => !t.dueDate && t.status !== 'done'), { key: 'priority', reversed: false }),
    [visible],
  );
  const projectOf = (t: Task) => projects.find((p) => p.id === t.projectId);

  const days = mode === 'month' ? monthGrid(cursor, weekStartsOn) : weekDays(cursor, weekStartsOn);
  const title =
    mode === 'month'
      ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;

  const step = (dir: -1 | 1) => setCursor((c) => (mode === 'month' ? addMonths(c, dir) : addDays(c, 7 * dir)));
  const goToday = () => {
    setCursor(new Date());
    setSelected(new Date());
  };
  const selectDay = (day: Date) => {
    setSelected(day);
    setPanel('day');
    // Follow the selection into a neighbouring month/week.
    if (mode === 'month' && day.getMonth() !== cursor.getMonth()) setCursor(new Date(day.getFullYear(), day.getMonth(), 1));
    if (mode === 'week' && !days.some((d) => isSameDay(d, day))) setCursor(day);
  };

  /** Arrow keys move the selected day; Enter adds a task on it. */
  const onGridKey = (e: KeyboardEvent, day: Date) => {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: mode === 'month' ? -7 : 0, ArrowDown: mode === 'month' ? 7 : 0 };
    if (e.key in delta && delta[e.key] !== 0) {
      e.preventDefault();
      const next = addDays(day, delta[e.key]);
      pendingFocus.current = toISODate(next);
      selectDay(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openTaskForm({ defaults: { dueDate: toISODate(day) } });
    }
  };

  const allowDrop = (e: DragEvent, target: DropTarget) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (target?.iso !== dropTarget?.iso || target?.minutes !== dropTarget?.minutes) setDropTarget(target);
  };

  const drop = (e: DragEvent, iso: string, minutes: number | null | undefined) => {
    e.preventDefault();
    setDropTarget(null);
    const task = tasks.find((t) => t.id === e.dataTransfer.getData(DRAG_TYPE));
    if (!task) return;
    // `undefined` minutes = month cell: keep the existing time. `null` = all-day row.
    const dueTime = minutes === undefined ? (task.dueDate ? task.dueTime : null) : minutes === null ? null : minutesToTime(minutes);
    if (task.dueDate === iso && task.dueTime === dueTime) return;
    const previous = { dueDate: task.dueDate, dueTime: task.dueTime };
    updateTask(task.id, { dueDate: iso, dueTime });
    toast({
      title: previous.dueDate ? 'Task rescheduled' : 'Task scheduled',
      description: `${task.title} → ${new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${dueTime ? `, ${formatTime(dueTime)}` : ''}`,
      action: { label: 'Undo', onClick: () => updateTask(task.id, previous) },
    });
  };

  const selectedTasks = byDate.get(toISODate(selected)) ?? [];

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Plan by due date. Drag tasks between days, onto an hour in week view, or from the unscheduled list."
        actions={
          <>
            <ViewSwitcher />
            <button className="btn-primary" onClick={() => openTaskForm({ defaults: { dueDate: toISODate(selected) } })}>
              <Plus className="h-4 w-4" /> New task
            </button>
          </>
        }
      />
      <div className="mb-5">
        <TaskToolbar showSort={false} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-hidden" aria-label="Calendar">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
            <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white" aria-live="polite">
              {title}
            </h2>
            <div className="flex items-center gap-1">
              <button className="btn-icon h-8 w-8" aria-label={`Previous ${mode}`} onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="btn-secondary btn-sm" onClick={goToday}>
                Today
              </button>
              <button className="btn-icon h-8 w-8" aria-label={`Next ${mode}`} onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Segmented
              size="sm"
              label="Calendar range"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
              ]}
            />
          </div>

          <div ref={gridRef}>
            {mode === 'month' ? (
              <MonthGrid
                days={days}
                cursor={cursor}
                now={now}
                selected={selected}
                weekStartsOn={weekStartsOn}
                byDate={byDate}
                dropTarget={dropTarget}
                onSelect={selectDay}
                onKey={onGridKey}
                onAdd={(iso) => openTaskForm({ defaults: { dueDate: iso } })}
                onDragOver={(e, iso) => allowDrop(e, { iso, minutes: null })}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e, iso) => drop(e, iso, undefined)}
              />
            ) : (
              <WeekGrid
                days={days}
                now={now}
                selected={selected}
                byDate={byDate}
                dropTarget={dropTarget}
                onSelect={selectDay}
                onKey={onGridKey}
                onAllowDrop={allowDrop}
                onDragLeave={() => setDropTarget(null)}
                onDrop={drop}
                onAdd={(iso, minutes) => openTaskForm({ defaults: { dueDate: iso, dueTime: minutes === null ? null : minutesToTime(minutes) } })}
              />
            )}
          </div>
        </section>

        <aside className="card self-start p-4 sm:p-5">
          <Segmented
            className="mb-4 w-full"
            size="sm"
            label="Side panel"
            value={panel}
            onChange={setPanel}
            options={[
              { value: 'day', label: selected.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) },
              {
                value: 'unscheduled',
                label: (
                  <>
                    <Inbox className="h-3.5 w-3.5" /> Unscheduled
                    {unscheduled.length > 0 && <span className="rounded bg-slate-200/80 px-1 text-[10px] tabular-nums dark:bg-white/10">{unscheduled.length}</span>}
                  </>
                ),
              },
            ]}
          />
          {panel === 'day' ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {pluralize(selectedTasks.length, 'task')}
                </p>
                <button className="btn-secondary btn-sm" onClick={() => openTaskForm({ defaults: { dueDate: toISODate(selected) } })}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {selectedTasks.length === 0 ? (
                <EmptyState compact icon={CalendarPlus} title="Nothing scheduled" description="Press Enter on a day, double-click it, or use Add." />
              ) : (
                <div className="-mx-3 divide-y divide-slate-100 dark:divide-white/[0.05]">
                  <AnimatePresence initial={false}>
                    {selectedTasks.map((t) => (
                      <TaskRow key={t.id} task={t} project={projectOf(t)} compact />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          ) : unscheduled.length === 0 ? (
            <EmptyState compact icon={Inbox} title="Everything is scheduled" description="Open tasks without a due date appear here." />
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">Drag a task onto a day to schedule it.</p>
              <ul className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {unscheduled.map((t) => (
                  <li key={t.id}>
                    <CalendarPill task={t} overdue={false} variant="tray" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

interface MonthGridProps {
  days: Date[];
  cursor: Date;
  now: Date;
  selected: Date;
  weekStartsOn: 0 | 1;
  byDate: Map<string, Task[]>;
  dropTarget: DropTarget;
  onSelect: (d: Date) => void;
  onKey: (e: KeyboardEvent, d: Date) => void;
  onAdd: (iso: string) => void;
  onDragOver: (e: DragEvent, iso: string) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, iso: string) => void;
}

function MonthGrid({ days, cursor, now, selected, weekStartsOn, byDate, dropTarget, onSelect, onKey, onAdd, onDragOver, onDragLeave, onDrop }: MonthGridProps) {
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  return (
    <div role="grid" aria-label="Month">
      <div role="row" className="grid grid-cols-7 border-b border-slate-100 dark:border-white/[0.06]">
        {weekdayLabels(weekStartsOn).map((d) => (
          <div key={d} role="columnheader" className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div role="row" key={wi} className="grid grid-cols-7">
          {week.map((day) => {
            const iso = toISODate(day);
            const list = byDate.get(iso) ?? [];
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = isSameDay(day, now);
            const isSelected = isSameDay(day, selected);
            const isDrop = dropTarget?.iso === iso;
            return (
              <div
                key={iso}
                role="gridcell"
                data-day={iso}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${pluralize(list.length, 'task')}`}
                onClick={() => onSelect(day)}
                onDoubleClick={() => onAdd(iso)}
                onKeyDown={(e) => onKey(e, day)}
                onDragOver={(e) => onDragOver(e, iso)}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onDragLeave()}
                onDrop={(e) => onDrop(e, iso)}
                className={cn(
                  'group relative min-h-[64px] cursor-pointer border-b border-r border-slate-100 p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/60 sm:min-h-[116px] sm:p-2 dark:border-white/[0.05]',
                  !inMonth && 'bg-slate-50/60 dark:bg-white/[0.012]',
                  isSelected ? 'bg-violet-50/70 dark:bg-violet-500/[0.07]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.025]',
                  isDrop && 'bg-violet-100/70 ring-2 ring-inset ring-violet-400 dark:bg-violet-500/15',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'grid h-6 min-w-[24px] place-items-center rounded-full px-1 text-xs font-semibold tabular-nums',
                      isToday ? 'bg-violet-600 text-white' : inMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <button
                    tabIndex={-1}
                    className="hidden rounded-md p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200/70 hover:text-slate-700 group-hover:opacity-100 sm:block dark:hover:bg-white/10"
                    aria-label={`Add task on ${iso}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(iso);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {list.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                    {list.slice(0, 4).map((t) => (
                      <span key={t.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIORITY_META[t.priority].color, opacity: t.status === 'done' ? 0.35 : 1 }} />
                    ))}
                  </div>
                )}
                <div className="hidden space-y-1 sm:block">
                  {list.slice(0, MONTH_LIMIT).map((t) => (
                    <CalendarPill key={t.id} task={t} overdue={isOverdue(t, now)} />
                  ))}
                  {list.length > MONTH_LIMIT && (
                    <button
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(day);
                      }}
                      className="block w-full rounded px-1.5 text-left text-[11px] font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-500/10"
                    >
                      +{list.length - MONTH_LIMIT} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface WeekGridProps {
  days: Date[];
  now: Date;
  selected: Date;
  byDate: Map<string, Task[]>;
  dropTarget: DropTarget;
  onSelect: (d: Date) => void;
  onKey: (e: KeyboardEvent, d: Date) => void;
  onAllowDrop: (e: DragEvent, t: DropTarget) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent, iso: string, minutes: number | null) => void;
  onAdd: (iso: string, minutes: number | null) => void;
}

/** Assigns side-by-side lanes to timed tasks whose one-hour blocks overlap. */
function layoutLanes(tasks: Task[]) {
  const timed = tasks.filter((t) => t.dueTime).sort((a, b) => a.dueTime!.localeCompare(b.dueTime!));
  const laneEnds: number[] = [];
  const placed = timed.map((t) => {
    const start = timeToMinutes(t.dueTime!);
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = start + 60;
    return { task: t, start, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

function WeekGrid({ days, now, selected, byDate, dropTarget, onSelect, onKey, onAllowDrop, onDragLeave, onDrop, onAdd }: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Start the day view around the working morning.
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  const minutesAt = (e: DragEvent | React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const raw = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
    return Math.min(24 * 60 - SNAP_MINUTES, Math.max(0, Math.floor(raw / SNAP_MINUTES) * SNAP_MINUTES));
  };

  return (
    <>
      {/* Phones: a stacked agenda is easier to read than a seven-column grid. */}
      <div className="divide-y divide-slate-100 sm:hidden dark:divide-white/[0.05]">
        {days.map((day) => {
          const iso = toISODate(day);
          const list = byDate.get(iso) ?? [];
          return (
            <div key={iso} className="px-4 py-3">
              <button
                onClick={() => onSelect(day)}
                className={cn('mb-2 text-xs font-semibold uppercase tracking-wider', isSameDay(day, now) ? 'text-violet-600' : 'text-slate-500')}
              >
                {day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </button>
              {list.length === 0 ? (
                <p className="text-xs text-slate-400">No tasks</p>
              ) : (
                <div className="space-y-1">
                  {list.map((t) => (
                    <CalendarPill key={t.id} task={t} overdue={isOverdue(t, now)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block" role="grid" aria-label="Week">
        <div role="row" className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-100 dark:border-white/[0.06]">
          <div />
          {days.map((day) => {
            const iso = toISODate(day);
            const isToday = isSameDay(day, now);
            const isSelected = isSameDay(day, selected);
            return (
              <div
                key={iso}
                role="columnheader"
                data-day={iso}
                tabIndex={isSelected ? 0 : -1}
                aria-selected={isSelected}
                onClick={() => onSelect(day)}
                onKeyDown={(e) => onKey(e, day)}
                className={cn(
                  'cursor-pointer py-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/60',
                  isSelected && 'bg-violet-50/70 dark:bg-violet-500/[0.07]',
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div
                  className={cn(
                    'mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold tabular-nums',
                    isToday ? 'bg-violet-600 text-white' : 'text-slate-800 dark:text-slate-100',
                  )}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row: tasks without a time. */}
        <div role="row" className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-100 dark:border-white/[0.06]">
          <div className="pr-2 pt-2 text-right text-[10px] font-medium uppercase text-slate-400">All day</div>
          {days.map((day) => {
            const iso = toISODate(day);
            const allDay = (byDate.get(iso) ?? []).filter((t) => !t.dueTime);
            const isDrop = dropTarget?.iso === iso && dropTarget.minutes === null;
            return (
              <div
                key={iso}
                role="gridcell"
                onDragOver={(e) => onAllowDrop(e, { iso, minutes: null })}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onDragLeave()}
                onDrop={(e) => onDrop(e, iso, null)}
                onDoubleClick={() => onAdd(iso, null)}
                className={cn(
                  'min-h-[44px] space-y-1 border-l border-slate-100 p-1 dark:border-white/[0.05]',
                  isDrop && 'bg-violet-100/70 ring-2 ring-inset ring-violet-400 dark:bg-violet-500/15',
                )}
              >
                {allDay.map((t) => (
                  <CalendarPill key={t.id} task={t} overdue={isOverdue(t, now)} />
                ))}
              </div>
            );
          })}
        </div>

        <div ref={scrollRef} className="relative max-h-[600px] overflow-y-auto">
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_HEIGHT }}>
            <div className="relative">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-slate-400" style={{ top: h * HOUR_HEIGHT }}>
                  {h === 0 ? '' : formatTime(`${pad(h)}:00`)}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const iso = toISODate(day);
              const { placed, lanes } = layoutLanes(byDate.get(iso) ?? []);
              const isToday = isSameDay(day, now);
              const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
              const drop = dropTarget?.iso === iso && dropTarget.minutes !== null ? dropTarget.minutes : null;
              return (
                <div
                  key={iso}
                  role="gridcell"
                  aria-label={day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  className={cn('relative border-l border-slate-100 dark:border-white/[0.05]', isToday && 'bg-violet-50/30 dark:bg-violet-500/[0.03]')}
                  style={{
                    backgroundImage: 'linear-gradient(to bottom, var(--hour-line) 1px, transparent 1px)',
                    backgroundSize: `100% ${HOUR_HEIGHT}px`,
                  }}
                  onDragOver={(e) => onAllowDrop(e, { iso, minutes: minutesAt(e) })}
                  onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onDragLeave()}
                  onDrop={(e) => onDrop(e, iso, minutesAt(e))}
                  onDoubleClick={(e) => onAdd(iso, minutesAt(e))}
                >
                  {drop !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-dashed border-violet-400 bg-violet-100/60 px-1.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                      style={{ top: (drop / 60) * HOUR_HEIGHT, height: HOUR_HEIGHT - 4 }}
                    >
                      {formatTime(minutesToTime(drop))}
                    </div>
                  )}
                  {placed.map(({ task, start, lane }) => (
                    <div
                      key={task.id}
                      className="absolute z-[5] px-0.5"
                      style={{ top: (start / 60) * HOUR_HEIGHT + 1, height: HOUR_HEIGHT - 3, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}
                    >
                      <CalendarPill task={task} overdue={isOverdue(task, now)} variant="block" />
                    </div>
                  ))}
                  {isToday && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }} aria-hidden>
                      <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                      <span className="h-px flex-1 bg-rose-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function CalendarPill({ task, overdue, variant = 'pill' }: { task: Task; overdue: boolean; variant?: 'pill' | 'block' | 'tray' }) {
  const { openTaskDetail } = useUIActions();
  const color = PRIORITY_META[task.priority].color;
  const done = task.status === 'done';
  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => {
        e.stopPropagation();
        openTaskDetail(task.id);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      title={task.title}
      className={cn(
        'flex w-full cursor-grab gap-1.5 rounded-md border-l-[3px] text-left font-medium transition hover:brightness-95 active:cursor-grabbing dark:hover:brightness-125',
        variant === 'block' ? 'h-full flex-col items-start overflow-hidden px-1.5 py-1 text-[11px]' : 'items-center px-1.5 py-1 text-[11.5px]',
        variant === 'tray' && 'py-2 text-[13px]',
        done ? 'text-slate-400 line-through' : overdue ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200',
      )}
      style={{ borderLeftColor: color, backgroundColor: `${color}${done ? '0d' : variant === 'block' ? '22' : '17'}` }}
    >
      {task.dueTime && variant !== 'tray' && <span className="shrink-0 text-[10.5px] tabular-nums opacity-70">{formatTime(task.dueTime)}</span>}
      <span className={cn('min-w-0', variant === 'block' ? 'line-clamp-2' : 'truncate')}>{task.title}</span>
      {task.recurrence && variant !== 'block' && <Repeat className="ml-auto h-3 w-3 shrink-0 opacity-60" aria-label="Repeats" />}
    </button>
  );
}
