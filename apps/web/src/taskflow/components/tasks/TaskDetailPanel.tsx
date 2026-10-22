// @ts-nocheck
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, NotebookPen, Repeat } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CalendarDays,
  Copy,
  Flag,
  FolderKanban,
  History,
  ListChecks,
  Pencil,
  Plus,
  Tag,
  Tags,
  Trash2,
  X,
  CircleDot,
} from 'lucide-react';
import type { Priority, RecurrenceFrequency, Task, TaskStatus } from '../../types';
import { RECURRENCE_OPTIONS, describeRecurrence, makeRecurrence } from '../../lib/recurrence';
import { toISODate } from '../../lib/date';
import { formatDateTime, formatDueLabel, relativeTime } from '../../lib/date';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, isOverdue, subtaskProgress } from '../../lib/tasks';
import { cn, percent } from '../../lib/utils';
import { useData } from '../../store/DataContext';
import { useUI } from '../../store/UIContext';
import { useTaskActions } from '../../hooks/useTaskActions';
import { Drawer } from '../ui/Drawer';
import { Checkbox } from '../ui/Checkbox';
import { ProgressBar } from '../ui/Progress';
import { TagChip } from '../ui/Badges';

export function TaskDetailPanel() {
  const { detailTaskId, closeTaskDetail } = useUI();
  const { tasks } = useData();
  const task = tasks.find((t) => t.id === detailTaskId);
  // Keep the last task around so the drawer can animate out after a delete.
  const lastTask = useRef<Task>();
  if (task) lastTask.current = task;

  useEffect(() => {
    if (detailTaskId && !task) closeTaskDetail();
  }, [detailTaskId, task, closeTaskDetail]);

  const shown = task ?? lastTask.current;
  return (
    <Drawer open={!!task} onClose={closeTaskDetail} label="Task details">
      {shown && <DetailBody task={shown} />}
    </Drawer>
  );
}

function DetailBody({ task }: { task: Task }) {
  const { now, closeTaskDetail, openTaskForm, navigate } = useUI();
  const { projects, activity, updateTask, setStatus, toggleSubtask, addSubtask, removeSubtask, updateNotes } = useData();
  const actions = useTaskActions();
  const [draft, setDraft] = useState('');
  const project = projects.find((p) => p.id === task.projectId);
  const overdue = isOverdue(task, now);
  const subs = subtaskProgress(task);
  const history = activity.filter((a) => a.taskId === task.id).slice(0, 6);
  const done = task.status === 'done';

  return (
    <>
      <header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]">
        <div className="min-w-0 flex-1 text-[13px] text-slate-500 dark:text-slate-400">
          {project ? (
            <button
              className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-white/5"
              onClick={() => {
                closeTaskDetail();
                navigate({ name: 'project', id: project.id });
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
              <span className="truncate">{project.name}</span>
            </button>
          ) : (
            <span className="px-1.5">No project</span>
          )}
        </div>
        <button className="btn-icon h-8 w-8" title="Edit task" aria-label="Edit task" onClick={() => openTaskForm({ taskId: task.id })}>
          <Pencil className="h-4 w-4" />
        </button>
        <button className="btn-icon h-8 w-8" title="Duplicate" aria-label="Duplicate task" onClick={() => actions.duplicate(task)}>
          <Copy className="h-4 w-4" />
        </button>
        <button
          className="btn-icon h-8 w-8 hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10"
          title="Delete"
          aria-label="Delete task"
          onClick={() => void actions.requestDelete(task)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
        <button className="btn-icon h-8 w-8" aria-label="Close details" onClick={closeTaskDetail}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        <div className="flex items-start gap-3">
          <div className="pt-1.5">
            <Checkbox
              checked={done}
              onChange={() => actions.toggleComplete(task)}
              color={PRIORITY_META[task.priority].color}
              label={done ? 'Mark as not completed' : 'Mark as completed'}
            />
          </div>
          <h2
            className={cn(
              'text-xl font-semibold leading-snug tracking-tight',
              done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-900 dark:text-white',
            )}
          >
            {task.title}
          </h2>
        </div>

        {overdue && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle className="h-4 w-4" /> This task is overdue
          </div>
        )}

        <dl className="mt-6 space-y-1">
          <Property icon={CircleDot} label="Status">
            <InlineSelect
              label="Status"
              value={task.status}
              onChange={(v) => setStatus(task.id, v as TaskStatus)}
              options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              dot={STATUS_META[task.status].color}
            />
          </Property>
          <Property icon={Flag} label="Priority">
            <InlineSelect
              label="Priority"
              value={task.priority}
              onChange={(v) => updateTask(task.id, { priority: v as Priority })}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
              dot={PRIORITY_META[task.priority].color}
            />
          </Property>
          <Property icon={CalendarDays} label="Due date">
            <button
              onClick={() => openTaskForm({ taskId: task.id })}
              className={cn(
                'rounded-md px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/5',
                overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200',
                !task.dueDate && 'text-slate-400 dark:text-slate-500',
              )}
            >
              {task.dueDate ? formatDueLabel(task.dueDate, task.dueTime, now) : 'No due date'}
            </button>
          </Property>
          <Property icon={FolderKanban} label="Project">
            <InlineSelect
              label="Project"
              value={task.projectId ?? ''}
              onChange={(v) => updateTask(task.id, { projectId: v || null })}
              options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
              dot={project?.color}
            />
          </Property>
          <Property icon={Tag} label="Category">
            <span className={cn('px-2 text-sm', task.category ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400')}>
              {task.category ?? 'None'}
            </span>
          </Property>
          <Property icon={Repeat} label="Repeat">
            <div className="flex flex-wrap items-center gap-2">
              <InlineSelect
                label="Repeat"
                value={task.recurrence?.frequency ?? ''}
                onChange={(v) =>
                  updateTask(task.id, {
                    recurrence: v ? makeRecurrence(v as RecurrenceFrequency, task.recurrence?.interval ?? 1, task.recurrence?.until ?? null) : null,
                    // A repeating task needs an anchor date.
                    ...(v && !task.dueDate ? { dueDate: toISODate(now) } : {}),
                  })
                }
                options={[{ value: '', label: 'Does not repeat' }, ...RECURRENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
              />
              {task.recurrence && ((task.recurrence.interval > 1 && task.recurrence.frequency !== 'weekdays') || task.recurrence.until) && (
                <span className="text-xs text-slate-500">{describeRecurrence(task.recurrence)}</span>
              )}
            </div>
          </Property>
          <Property icon={Tags} label="Tags">
            {task.tags.length ? (
              <div className="flex flex-wrap gap-1.5 px-2">
                {task.tags.map((t) => (
                  <TagChip key={t} tag={t} />
                ))}
              </div>
            ) : (
              <span className="px-2 text-sm text-slate-400">None</span>
            )}
          </Property>
        </dl>

        <section className="mt-8">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Description</h3>
          {task.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{task.description}</p>
          ) : (
            <button onClick={() => openTaskForm({ taskId: task.id })} className="text-sm text-slate-400 hover:text-violet-600">
              Add a description…
            </button>
          )}
        </section>

        <NotesEditor key={task.id} initial={task.notes} onSave={(notes) => updateNotes(task.id, notes)} />

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <ListChecks className="h-4 w-4" /> Subtasks
            </h3>
            {subs.total > 0 && (
              <span className="text-xs font-medium text-slate-500">
                {subs.done}/{subs.total} · {percent(subs.done, subs.total)}%
              </span>
            )}
          </div>
          {subs.total > 0 && <ProgressBar value={percent(subs.done, subs.total)} label="Subtask progress" className="mb-3" />}
          <ul className="space-y-0.5">
            <AnimatePresence initial={false}>
              {task.subtasks.map((s) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                >
                  <Checkbox size="sm" checked={s.done} onChange={() => toggleSubtask(task.id, s.id)} label={`Toggle subtask ${s.title}`} />
                  <span className={cn('flex-1 text-sm', s.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200')}>
                    {s.title}
                  </span>
                  <button
                    className="rounded p-1 text-slate-400 opacity-0 transition hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Remove subtask ${s.title}`}
                    onClick={() => removeSubtask(task.id, s.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addSubtask(task.id, draft);
              setDraft('');
            }}
          >
            <Plus className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add subtask"
              aria-label="Add subtask"
              className="h-9 flex-1 rounded-lg bg-transparent px-1 text-sm outline-none placeholder:text-slate-400 focus:bg-slate-50 dark:focus:bg-white/[0.03]"
            />
            {draft.trim() && (
              <button type="submit" className="btn-primary btn-sm">
                Add
              </button>
            )}
          </form>
        </section>

        {history.length > 0 && (
          <section className="mt-8">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <History className="h-4 w-4" /> Activity
            </h3>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-white/10">
              {history.map((a) => (
                <li key={a.id} className="relative text-[13px]">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-violet-400 ring-4 ring-white dark:ring-ink-900" />
                  <span className="text-slate-700 dark:text-slate-300">{a.message}</span>
                  <span className="ml-2 text-slate-400">{relativeTime(a.at, now)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <footer className="space-y-0.5 border-t border-slate-100 px-5 py-3 text-xs text-slate-400 sm:px-7 dark:border-white/[0.06]">
        <p>Created {formatDateTime(task.createdAt)}</p>
        {task.completedAt ? <p>Completed {formatDateTime(task.completedAt)}</p> : <p>Last updated {relativeTime(task.updatedAt, now)}</p>}
      </footer>
    </>
  );
}

function Property({ icon: Icon, label, children }: { icon: typeof Flag; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2 py-0.5">
      <dt className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

interface InlineSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  dot?: string;
}

function InlineSelect({ label, value, onChange, options, dot }: InlineSelectProps) {
  return (
    <div className="relative inline-flex max-w-full items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/5">
      {dot && <span className="pointer-events-none absolute left-2 h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'max-w-full cursor-pointer appearance-none truncate rounded-md bg-transparent py-1 pr-2 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:text-slate-200 [&>option]:dark:bg-ink-800',
          dot ? 'pl-6' : 'pl-2',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Inline notes editor that autosaves shortly after typing stops and on blur. */
function NotesEditor({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<'idle' | 'dirty' | 'saved'>('idle');
  const timer = useRef<number>();
  const latest = useRef(value);
  latest.current = value;

  const save = () => {
    window.clearTimeout(timer.current);
    if (latest.current === initial) return;
    onSave(latest.current);
    setState('saved');
  };

  // Flush pending edits if the panel closes mid-typing.
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (latest.current !== initial) onSave(latest.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <NotebookPen className="h-4 w-4" /> Notes
        </h3>
        <span className="text-[11px] text-slate-400" aria-live="polite">
          {state === 'dirty' ? 'Editing…' : state === 'saved' ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : null}
        </span>
      </div>
      <textarea
        value={value}
        maxLength={10000}
        rows={Math.min(10, Math.max(3, value.split('\n').length + 1))}
        aria-label="Task notes"
        placeholder="Jot down progress, links or decisions…"
        onChange={(e) => {
          setValue(e.target.value);
          setState('dirty');
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(save, 700);
        }}
        onBlur={save}
        className="w-full resize-none rounded-xl border border-transparent bg-amber-50/50 px-3 py-2.5 text-sm leading-relaxed text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-amber-200/70 focus:border-amber-300 focus:bg-amber-50/80 dark:bg-amber-400/[0.04] dark:text-slate-300 dark:hover:border-amber-300/20 dark:focus:border-amber-300/30"
      />
    </section>
  );
}
