// @ts-nocheck
import { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { AlignLeft, CalendarDays, Copy, ListChecks, MoreHorizontal, NotebookPen, Pencil, Repeat, Trash2 } from 'lucide-react';
import { describeRecurrence } from '../../lib/recurrence';
import type { Project, Task } from '../../types';
import { formatDueLabel } from '../../lib/date';
import { PRIORITY_META, isOverdue, subtaskProgress } from '../../lib/tasks';
import { cn } from '../../lib/utils';
import { useClock, useUIActions, useUIState } from '../../store/UIContext';
import { Highlight } from '../ui/Highlight';
import { useTaskActions } from '../../hooks/useTaskActions';
import { Checkbox } from '../ui/Checkbox';
import { PriorityBadge, ProjectLabel, TagChip } from '../ui/Badges';
import { Menu } from '../ui/Menu';

interface TaskRowProps {
  task: Task;
  project?: Project;
  showProject?: boolean;
  /** Narrow containers: hide secondary metadata. */
  compact?: boolean;
  /** Show a selection checkbox for bulk actions. */
  selectable?: boolean;
  /** Highlight words from the current search in the title. */
  highlightSearch?: boolean;
}

interface TaskRowViewProps extends Omit<TaskRowProps, 'highlightSearch'> {
  now: Date;
  selected: boolean;
  selecting: boolean;
  query: string;
}

/**
 * Subscribes to the UI state it needs and hands plain props to a memoized view, so a
 * change elsewhere (another task, a dialog opening) doesn't re-render every row.
 */
export const TaskRow = forwardRef<HTMLDivElement, TaskRowProps>(function TaskRow({ highlightSearch = false, ...props }, ref) {
  const { selectedIds, filters } = useUIState();
  const now = useClock();
  const selectable = props.selectable ?? false;
  return (
    <TaskRowView
      ref={ref}
      {...props}
      now={now}
      selected={selectable && selectedIds.includes(props.task.id)}
      // While a selection exists, clicking a row extends it instead of opening details.
      selecting={selectable && selectedIds.length > 0}
      query={highlightSearch ? filters.search : ''}
    />
  );
});

const TaskRowView = memo(
  forwardRef<HTMLDivElement, TaskRowViewProps>(function TaskRowView(
    { task, project, showProject = true, compact = false, selectable = false, now, selected, selecting, query },
    ref,
  ) {
    const { openTaskDetail, openTaskForm, toggleSelected } = useUIActions();
    const actions = useTaskActions();
    const done = task.status === 'done';
    const overdue = isOverdue(task, now);
    const subs = subtaskProgress(task);

    return (
      <motion.div
        ref={ref}
        layout="position"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
        onClick={() => (selecting ? toggleSelected(task.id) : openTaskDetail(task.id))}
        data-task-row={task.id}
        aria-selected={selectable ? selected : undefined}
        className={cn(
          'group relative flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors',
          selected ? 'bg-violet-50/80 dark:bg-violet-500/[0.08]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]',
        )}
      >
        {selectable && (
          <div className={cn('-ml-1 pt-[3px] transition-opacity', selecting ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100')}>
            <input
              type="checkbox"
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelected(task.id)}
              aria-label={`Select “${task.title}”`}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-violet-600"
            />
          </div>
        )}
        <div className="pt-px">
          <Checkbox
            checked={done}
            onChange={() => actions.toggleComplete(task)}
            color={PRIORITY_META[task.priority].color}
            label={done ? `Mark “${task.title}” as not completed` : `Complete “${task.title}”`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (selecting) toggleSelected(task.id);
              else openTaskDetail(task.id);
            }}
            data-row-focus
            className={cn(
              'block max-w-full truncate rounded text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
              done ? 'text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600' : 'text-slate-900 dark:text-slate-100',
            )}
          >
            <Highlight text={task.title} query={query} />
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {task.dueDate && (
              <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-rose-600 dark:text-rose-400')}>
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDueLabel(task.dueDate, task.dueTime, now)}
              </span>
            )}
            {task.status === 'in_progress' && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                In progress
              </span>
            )}
            {subs.total > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" />
                {subs.done}/{subs.total}
              </span>
            )}
            {task.recurrence && (
              <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300" title={describeRecurrence(task.recurrence)}>
                <Repeat className="h-3.5 w-3.5" />
                {!compact && <span className="hidden md:inline">{describeRecurrence(task.recurrence)}</span>}
              </span>
            )}
            {task.description && <AlignLeft className="h-3.5 w-3.5" aria-label="Has description" />}
            {task.notes && <NotebookPen className="h-3.5 w-3.5" aria-label="Has notes" />}
            {showProject && !compact && project && <ProjectLabel project={project} className="max-w-[140px]" />}
            {!compact && task.category && <span className="text-slate-400 dark:text-slate-500">{task.category}</span>}
            {!compact && task.tags.slice(0, 2).map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
            {!compact && task.tags.length > 2 && <span>+{task.tags.length - 2}</span>}
          </div>
        </div>

        {!compact && <PriorityBadge priority={task.priority} className="mt-px hidden sm:inline-flex" />}

        <div className="flex items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <button
            className="btn-icon hidden h-7 w-7 sm:inline-flex"
            aria-label="Edit task"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              openTaskForm({ taskId: task.id });
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <Menu
            items={[
              { label: 'Edit', icon: Pencil, onSelect: () => openTaskForm({ taskId: task.id }) },
              { label: 'Duplicate', icon: Copy, onSelect: () => actions.duplicate(task) },
              { label: 'Delete', icon: Trash2, onSelect: () => void actions.requestDelete(task), danger: true },
            ]}
            trigger={(props) => (
              <button {...props} className="btn-icon h-7 w-7" aria-label="More actions" title="More">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
          />
        </div>
      </motion.div>
    );
  }),
);
