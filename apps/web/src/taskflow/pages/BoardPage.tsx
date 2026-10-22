// @ts-nocheck
import { forwardRef, memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, ListChecks, NotebookPen, Plus, Repeat } from 'lucide-react';
import type { Project, Task, TaskStatus } from '../types';
import { useDataState } from '../store/DataContext';
import { useClock, useUIActions, useUIState } from '../store/UIContext';
import { useTaskActions } from '../hooks/useTaskActions';
import { useBoardDrag } from '../hooks/useBoardDrag';
import { describeRecurrence } from '../lib/recurrence';
import { formatDueLabel } from '../lib/date';
import { STATUSES, STATUS_META, filterTasks, isOverdue, subtaskProgress } from '../lib/tasks';
import { cn, percent } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { TaskToolbar, ViewSwitcher } from '../components/tasks/TaskToolbar';
import { PriorityBadge, ProjectLabel } from '../components/ui/Badges';
import { ProgressBar } from '../components/ui/Progress';

export function BoardPage() {
  const { tasks, projects } = useDataState();
  const { filters } = useUIState();
  const { openTaskForm } = useUIActions();
  const now = useClock();
  const actions = useTaskActions();
  const [announcement, setAnnouncement] = useState('');
  const pendingFocus = useRef<string | null>(null);

  // Keep keyboard focus on a card after it moves to a new place.
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    document.querySelector<HTMLElement>(`[data-card-id="${pendingFocus.current}"]`)?.focus();
    pendingFocus.current = null;
  });

  // Columns are statuses, so the status filter doesn't apply; cards follow their manual order.
  const columns = useMemo(() => {
    const visible = filterTasks(tasks, { ...filters, status: 'all' }, now, projects).sort((a, b) => a.order - b.order);
    return Object.fromEntries(STATUSES.map((s) => [s, visible.filter((t) => t.status === s)])) as Record<TaskStatus, Task[]>;
  }, [tasks, filters, now, projects]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const drop = (id: string, status: TaskStatus, beforeId: string | null) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    actions.moveToColumn(task, status, beforeId);
    setAnnouncement(`${task.title} moved to ${STATUS_META[status].label}`);
  };
  const { session, start, registerColumn, scrollerRef } = useBoardDrag(drop);

  // Stable wrappers so memoized cards don't re-render on every pointer move during a drag.
  const latest = useRef({ drop, onCardKey: (_e: KeyboardEvent, _t: Task) => {} });
  const onMoveCard = useCallback((id: string, status: TaskStatus) => latest.current.drop(id, status, null), []);
  const onCardKeyStable = useCallback((e: KeyboardEvent, t: Task) => latest.current.onCardKey(e, t), []);
  const dragged = session ? tasks.find((t) => t.id === session.id) : undefined;

  /** Keyboard moves: Alt + ←/→ changes column, Alt + ↑/↓ reorders within the column. */
  const onCardKey = (e: KeyboardEvent, task: Task) => {
    if (!e.altKey || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const col = columns[task.status];
    const index = col.findIndex((t) => t.id === task.id);
    const colIndex = STATUSES.indexOf(task.status);
    if (e.key === 'ArrowLeft' && colIndex > 0) drop(task.id, STATUSES[colIndex - 1], null);
    else if (e.key === 'ArrowRight' && colIndex < STATUSES.length - 1) drop(task.id, STATUSES[colIndex + 1], null);
    else if (e.key === 'ArrowUp' && index > 0) {
      actions.moveToColumn(task, task.status, col[index - 1].id);
      setAnnouncement(`${task.title} moved up`);
    } else if (e.key === 'ArrowDown' && index < col.length - 1) {
      actions.moveToColumn(task, task.status, col[index + 2]?.id ?? null);
      setAnnouncement(`${task.title} moved down`);
    } else return;
    pendingFocus.current = task.id;
  };
  latest.current = { drop, onCardKey };

  return (
    <>
      <PageHeader
        title="Board"
        description="Drag cards to change status or reorder them. On touch screens, press and hold a card to pick it up."
        actions={
          <>
            <ViewSwitcher />
            <button className="btn-primary" onClick={() => openTaskForm()}>
              <Plus className="h-4 w-4" /> New task
            </button>
          </>
        }
      />
      <div className="mb-5">
        <TaskToolbar showStatus={false} showSort={false} />
      </div>
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>

      <div
        ref={scrollerRef}
        className="-mx-4 grid snap-x snap-mandatory auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto px-4 pb-4 sm:auto-cols-[340px] lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible lg:px-0"
      >
        {STATUSES.map((status, colIndex) => {
          const column = columns[status];
          const isOver = session?.over === status;
          // Hide the insertion line when dropping would leave the card where it already is.
          const draggedIndex = session ? column.findIndex((t) => t.id === session.id) : -1;
          const noOp =
            draggedIndex >= 0 && (session!.beforeId === (column[draggedIndex + 1]?.id ?? null));
          const showLineBefore = (id: string | null) => isOver && !noOp && session!.beforeId === id;

          return (
            <section
              key={status}
              ref={registerColumn(status)}
              aria-label={`${STATUS_META[status].label} column, ${column.length} tasks`}
              className={cn(
                'flex min-h-[480px] snap-start flex-col rounded-2xl border p-2.5 transition-colors duration-150',
                isOver
                  ? 'border-violet-300 bg-violet-50/70 dark:border-violet-400/40 dark:bg-violet-500/[0.07]'
                  : 'border-slate-200/70 bg-slate-100/50 dark:border-white/[0.05] dark:bg-white/[0.02]',
              )}
            >
              <header className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                <span className={cn('h-2 w-2 rounded-full', STATUS_META[status].dot)} />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{STATUS_META[status].label}</h2>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-300">
                  {column.length}
                </span>
                <button
                  className="btn-icon ml-auto h-7 w-7"
                  aria-label={`Add task to ${STATUS_META[status].label}`}
                  onClick={() => openTaskForm({ defaults: { status } })}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </header>

              <div className="flex flex-1 flex-col">
                <AnimatePresence initial={false} mode="popLayout">
                  {column.map((task) => (
                    <motion.div
                      key={task.id}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      className="pb-2"
                    >
                      {showLineBefore(task.id) && <DropLine />}
                      <BoardCard
                        task={task}
                        project={task.projectId ? projectById.get(task.projectId) : undefined}
                        now={now}
                        dragging={session?.id === task.id}
                        onPointerDown={start}
                        onKeyDown={onCardKeyStable}
                        prevStatus={STATUSES[colIndex - 1] ?? null}
                        nextStatus={STATUSES[colIndex + 1] ?? null}
                        onMove={onMoveCard}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {showLineBefore(null) && column.length > 0 && <DropLine />}
                {column.length === 0 && (
                  <div
                    className={cn(
                      'grid flex-1 place-items-center rounded-xl border-2 border-dashed px-4 py-10 text-center text-[13px] transition-colors',
                      isOver ? 'border-violet-300 text-violet-600 dark:border-violet-400/40 dark:text-violet-300' : 'border-slate-200 text-slate-400 dark:border-white/[0.07]',
                    )}
                  >
                    {isOver ? 'Drop here' : 'No tasks here yet'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {session &&
        dragged &&
        createPortal(
          <div
            className="pointer-events-none fixed left-0 top-0 z-[80]"
            style={{ width: session.width, transform: `translate(${session.x - session.offsetX}px, ${session.y - session.offsetY}px)` }}
          >
            <div className="rotate-[2deg] scale-[1.02] opacity-95 shadow-pop">
              <CardBody task={dragged} project={dragged.projectId ? projectById.get(dragged.projectId) : undefined} now={now} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function DropLine() {
  return <div className="mb-2 h-0.5 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]" aria-hidden />;
}

interface BoardCardProps {
  task: Task;
  project?: Project;
  now: Date;
  dragging: boolean;
  onPointerDown: (e: PointerEvent<HTMLElement>, id: string) => void;
  onKeyDown: (e: KeyboardEvent, task: Task) => void;
  onMove: (id: string, status: TaskStatus) => void;
  prevStatus: TaskStatus | null;
  nextStatus: TaskStatus | null;
}

const BoardCard = memo(
  forwardRef<HTMLDivElement, BoardCardProps>(function BoardCard(
    { task, project, now, dragging, onPointerDown, onKeyDown, onMove, prevStatus, nextStatus },
    ref,
  ) {
    const { openTaskDetail } = useUIActions();
    return (
      <div
        ref={ref}
        data-card-id={task.id}
        role="button"
        tabIndex={0}
        aria-roledescription="Draggable task card"
        aria-label={`${task.title}. ${STATUS_META[task.status].label}. Press Enter to open, Alt plus arrow keys to move.`}
        onPointerDown={(e) => onPointerDown(e, task.id)}
        onClick={() => openTaskDetail(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') openTaskDetail(task.id);
          else onKeyDown(e, task);
        }}
        style={{ WebkitTouchCallout: 'none' }}
        className={cn(
          'group relative cursor-grab touch-manipulation select-none rounded-2xl outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500/60 active:cursor-grabbing',
          dragging && 'opacity-40 [&>*]:border-dashed [&>*]:border-violet-300 dark:[&>*]:border-violet-400/40',
        )}
      >
        <CardBody task={task} project={project} now={now} interactive>
          <div className="flex items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
            {prevStatus && (
              <button
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="Move to previous column"
                title="Move left (Alt+←)"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task.id, prevStatus);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {nextStatus && (
              <button
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="Move to next column"
                title="Move right (Alt+→)"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(task.id, nextStatus);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardBody>
      </div>
    );
  }),
);

/** Visual content of a card, shared by the board and the drag preview. */
function CardBody({
  task,
  project,
  now,
  interactive = false,
  children,
}: {
  task: Task;
  project?: Project;
  now: Date;
  interactive?: boolean;
  children?: React.ReactNode;
}) {
  const overdue = isOverdue(task, now);
  const subs = subtaskProgress(task);
  const done = task.status === 'done';
  return (
    <div
      className={cn(
        'card p-3.5',
        interactive && 'group-hover:-translate-y-0.5 group-hover:shadow-card-hover dark:group-hover:border-white/[0.12]',
        'transition duration-150',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1">
          <GripVertical className="-ml-1 hidden h-4 w-4 text-slate-300 lg:block dark:text-slate-600" aria-hidden />
          <PriorityBadge priority={task.priority} />
        </span>
        {children}
      </div>
      <h3 className={cn('text-sm font-semibold leading-snug', done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-900 dark:text-slate-100')}>
        {task.title}
      </h3>
      {task.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{task.description}</p>}
      {subs.total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ListChecks className="h-3.5 w-3.5" /> Subtasks
            </span>
            <span className="tabular-nums">
              {subs.done}/{subs.total}
            </span>
          </div>
          <ProgressBar value={percent(subs.done, subs.total)} label="Subtask progress" className="h-1" />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex min-w-0 items-center gap-2">
          {project ? <ProjectLabel project={project} className="max-w-[150px]" /> : null}
          {task.notes && <NotebookPen className="h-3.5 w-3.5 shrink-0" aria-label="Has notes" />}
        </span>
        {task.dueDate && (
          <span className={cn('inline-flex shrink-0 items-center gap-1', overdue && 'font-medium text-rose-600 dark:text-rose-400')}>
            {task.recurrence && <Repeat className="h-3.5 w-3.5 text-violet-500" aria-label={describeRecurrence(task.recurrence)} />}
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDueLabel(task.dueDate, task.dueTime, now)}
          </span>
        )}
      </div>
    </div>
  );
}
