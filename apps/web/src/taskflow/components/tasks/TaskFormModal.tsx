// @ts-nocheck
import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CalendarDays, Clock, Plus, Repeat, Trash2, X } from 'lucide-react';
import type { Priority, Project, RecurrenceFrequency, TaskInput } from '../../types';
import { MAX_INTERVAL, RECURRENCE_OPTIONS, describeRecurrence, makeRecurrence } from '../../lib/recurrence';
import { addDays, isValidISODate, isValidTime, parseISODate, toISODate } from '../../lib/date';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META, getCategories, getTags } from '../../lib/tasks';
import { cn, uid } from '../../lib/utils';
import { useData } from '../../store/DataContext';
import { useUI } from '../../store/UIContext';
import { Modal } from '../ui/Modal';
import { Segmented, Select } from '../ui/Controls';
import { TagChip } from '../ui/Badges';
import { useToast } from '../ui/Toast';

const EMPTY: TaskInput = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  dueTime: null,
  projectId: null,
  category: null,
  tags: [],
  subtasks: [],
  notes: '',
  recurrence: null,
};

const LIMITS = { title: 200, description: 5000, notes: 10000, category: 40, tag: 30, tags: 10, subtasks: 50 };
const FORM_ID = 'task-form';

type Errors = Partial<Record<'title' | 'description' | 'notes' | 'dueDate' | 'dueTime' | 'until' | 'category' | 'tags', string>>;

export function TaskFormModal() {
  const { taskForm, closeTaskForm } = useUI();
  const { tasks, projects, createTask, updateTask } = useData();
  const toast = useToast();
  // Keep the last session's key while the dialog animates out, so the form doesn't flash empty.
  const sessionRef = useRef(0);
  if (taskForm.open) sessionRef.current = taskForm.session;
  const session = sessionRef.current;

  const editing = taskForm.open && taskForm.taskId ? tasks.find((t) => t.id === taskForm.taskId) : undefined;
  const initial: TaskInput = editing
    ? {
        title: editing.title,
        description: editing.description,
        status: editing.status,
        priority: editing.priority,
        dueDate: editing.dueDate,
        dueTime: editing.dueTime,
        projectId: editing.projectId,
        category: editing.category,
        tags: editing.tags,
        subtasks: editing.subtasks,
        notes: editing.notes,
        recurrence: editing.recurrence,
      }
    : { ...EMPTY, ...(taskForm.open ? taskForm.defaults : {}) };

  const handleSubmit = (input: TaskInput) => {
    if (editing) {
      updateTask(editing.id, input);
      toast({ title: 'Changes saved', description: input.title });
    } else {
      createTask(input);
      toast({ title: 'Task created', description: input.title });
    }
    closeTaskForm();
  };

  return (
    <Modal
      open={taskForm.open}
      onClose={closeTaskForm}
      size="lg"
      title={editing ? 'Edit task' : 'New task'}
      description={editing ? undefined : 'Capture what needs to get done. Only the title is required.'}
      footer={
        <>
          <span className="mr-auto hidden text-xs text-slate-400 sm:block">
            <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd> to save
          </span>
          <button type="button" className="btn-secondary" onClick={closeTaskForm}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className="btn-primary">
            {editing ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      <TaskForm
        key={session}
        initial={initial}
        projects={projects}
        categories={getCategories(tasks)}
        knownTags={getTags(tasks)}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}

interface TaskFormProps {
  initial: TaskInput;
  projects: Project[];
  categories: string[];
  knownTags: string[];
  onSubmit: (input: TaskInput) => void;
}

function TaskForm({ initial, projects, categories, knownTags, onSubmit }: TaskFormProps) {
  const [values, setValues] = useState<TaskInput>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [tagDraft, setTagDraft] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const today = useMemo(() => new Date(), []);

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addTag = (raw: string): string[] => {
    const tag = raw.trim().replace(/^#/, '').replace(/\s+/g, '-').toLowerCase();
    if (!tag) return values.tags;
    if (tag.length > LIMITS.tag) {
      setErrors((e) => ({ ...e, tags: `Tags can be at most ${LIMITS.tag} characters.` }));
      return values.tags;
    }
    if (values.tags.includes(tag)) return values.tags;
    if (values.tags.length >= LIMITS.tags) {
      setErrors((e) => ({ ...e, tags: `You can add up to ${LIMITS.tags} tags.` }));
      return values.tags;
    }
    const next = [...values.tags, tag];
    set('tags', next);
    setTagDraft('');
    return next;
  };

  const addSubtask = () => {
    const title = subtaskDraft.trim().slice(0, 200);
    if (!title || values.subtasks.length >= LIMITS.subtasks) return values.subtasks;
    const next = [...values.subtasks, { id: uid('s_'), title, done: false }];
    set('subtasks', next);
    setSubtaskDraft('');
    return next;
  };

  const validate = (v: TaskInput): Errors => {
    const e: Errors = {};
    if (!v.title.trim()) e.title = 'Give your task a title.';
    else if (v.title.trim().length > LIMITS.title) e.title = `Title must be under ${LIMITS.title} characters.`;
    if (v.description.length > LIMITS.description) e.description = `Description must be under ${LIMITS.description} characters.`;
    if (v.notes.length > LIMITS.notes) e.notes = `Notes must be under ${LIMITS.notes} characters.`;
    if (v.dueDate && !isValidISODate(v.dueDate)) e.dueDate = 'Enter a valid date.';
    if (v.dueTime && !isValidTime(v.dueTime)) e.dueTime = 'Enter a valid time.';
    if (v.dueTime && !v.dueDate) e.dueTime = 'Pick a due date before setting a time.';
    if (v.recurrence?.until && !isValidISODate(v.recurrence.until)) e.until = 'Enter a valid end date.';
    else if (v.recurrence?.until && v.dueDate && v.recurrence.until < v.dueDate) e.until = 'The end date must be on or after the due date.';
    if ((v.category ?? '').trim().length > LIMITS.category) e.category = `Category must be under ${LIMITS.category} characters.`;
    return e;
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    // Commit anything still typed in the tag/subtask inputs.
    const tags = tagDraft.trim() ? addTag(tagDraft) : values.tags;
    const subtasks = subtaskDraft.trim() ? addSubtask() : values.subtasks;
    const candidate: TaskInput = {
      ...values,
      tags,
      subtasks: subtasks.filter((s) => s.title.trim()),
      title: values.title.trim(),
      description: values.description.trim(),
      notes: values.notes.trim(),
      category: values.category?.trim() || null,
      // A repeating task needs an anchor date; start the series today if none was picked.
      dueDate: values.dueDate ?? (values.recurrence ? toISODate(today) : null),
      dueTime: values.dueDate ? values.dueTime : null,
    };
    const found = validate(candidate);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      const first = Object.keys(found)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    onSubmit(candidate);
  };

  const onFormKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  const quickDates = [
    { label: 'Today', value: toISODate(today) },
    { label: 'Tomorrow', value: toISODate(addDays(today, 1)) },
    { label: 'Next week', value: toISODate(addDays(today, 7)) },
  ];

  return (
    <form id={FORM_ID} ref={formRef} onSubmit={submit} onKeyDown={onFormKeyDown} noValidate className="space-y-5 pb-2">
      <div>
        <label htmlFor="task-title" className="label">
          Title
        </label>
        <input
          id="task-title"
          name="title"
          data-autofocus
          className={cn('input h-11 text-[15px] font-medium', errors.title && 'input-error')}
          placeholder="e.g. Prepare the quarterly report"
          value={values.title}
          maxLength={LIMITS.title + 20}
          onChange={(e) => set('title', e.target.value)}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'task-title-error' : undefined}
        />
        <FieldError id="task-title-error" message={errors.title} />
      </div>

      <div>
        <label htmlFor="task-description" className="label">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="task-description"
          name="description"
          rows={3}
          className={cn('input h-auto resize-y py-2.5 leading-relaxed', errors.description && 'input-error')}
          placeholder="Add details, links or context…"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
        <FieldError message={errors.description} />
      </div>

      <div>
        <span className="label">Priority</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Priority">
          {[...PRIORITIES].reverse().map((p: Priority) => {
            const active = values.priority === p;
            const meta = PRIORITY_META[p];
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set('priority', p)}
                className={cn(
                  'flex h-9 items-center justify-center gap-2 rounded-xl border text-[13px] font-medium transition',
                  active
                    ? 'border-transparent ring-2'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20',
                )}
                style={active ? { backgroundColor: `${meta.color}14`, color: meta.color, ['--tw-ring-color' as string]: meta.color } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-status" className="label">
            Status
          </label>
          <Select id="task-status" value={values.status} onChange={(e) => set('status', e.target.value as TaskInput['status'])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="task-project" className="label">
            Project
          </label>
          <Select id="task-project" value={values.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <span className="label">Due date</span>
        <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              name="dueDate"
              aria-label="Due date"
              className={cn('input pl-9', errors.dueDate && 'input-error')}
              value={values.dueDate ?? ''}
              onChange={(e) => set('dueDate', e.target.value || null)}
            />
          </div>
          <div className="relative">
            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="time"
              name="dueTime"
              aria-label="Due time (optional)"
              className={cn('input pl-9', errors.dueTime && 'input-error')}
              value={values.dueTime ?? ''}
              disabled={!values.dueDate}
              title={values.dueDate ? 'Optional time' : 'Pick a date first'}
              onChange={(e) => set('dueTime', e.target.value || null)}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickDates.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => set('dueDate', q.value)}
              className={cn(
                'h-7 rounded-lg px-2.5 text-xs font-medium transition',
                values.dueDate === q.value
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10',
              )}
            >
              {q.label}
            </button>
          ))}
          {values.dueDate && (
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, dueDate: null, dueTime: null }))}
              className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <FieldError message={errors.dueDate ?? errors.dueTime} />
      </div>

      <div>
        <label htmlFor="task-repeat" className="label">
          Repeat
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-52">
            <Repeat className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Select
              id="task-repeat"
              className="[&_select]:pl-9"
              value={values.recurrence?.frequency ?? 'none'}
              onChange={(e) => {
                const freq = e.target.value as RecurrenceFrequency | 'none';
                set('recurrence', freq === 'none' ? null : makeRecurrence(freq, values.recurrence?.interval ?? 1, values.recurrence?.until ?? null));
              }}
            >
              <option value="none">Does not repeat</option>
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {values.recurrence && values.recurrence.frequency !== 'weekdays' && (
            <label className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
              every
              <input
                type="number"
                min={1}
                max={MAX_INTERVAL}
                aria-label="Repeat interval"
                className="input h-9 w-20"
                value={values.recurrence.interval}
                onChange={(e) => {
                  const n = Math.min(MAX_INTERVAL, Math.max(1, Math.floor(Number(e.target.value) || 1)));
                  set('recurrence', { ...values.recurrence!, interval: n });
                }}
              />
              {RECURRENCE_OPTIONS.find((o) => o.value === values.recurrence!.frequency)!.unit}
              {values.recurrence.interval === 1 ? '' : 's'}
            </label>
          )}
        </div>
        {values.recurrence && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300">
            <span>Ends</span>
            <Segmented
              size="sm"
              label="Repeat ends"
              value={values.recurrence.until ? 'on' : 'never'}
              onChange={(v) =>
                set('recurrence', {
                  ...values.recurrence!,
                  until: v === 'never' ? null : toISODate(addDays(values.dueDate ? parseISODate(values.dueDate) : today, 30)),
                })
              }
              options={[
                { value: 'never', label: 'Never' },
                { value: 'on', label: 'On date' },
              ]}
            />
            {values.recurrence.until && (
              <input
                type="date"
                name="until"
                aria-label="Repeat end date"
                min={values.dueDate ?? undefined}
                className={cn('input h-8 w-44 text-[13px]', errors.until && 'input-error')}
                value={values.recurrence.until}
                onChange={(e) => set('recurrence', { ...values.recurrence!, until: e.target.value || null })}
              />
            )}
          </div>
        )}
        {values.recurrence && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {describeRecurrence(values.recurrence)}. Completing it schedules the next one automatically
            {values.dueDate ? '.' : ', starting today.'}
          </p>
        )}
        <FieldError message={errors.until} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-category" className="label">
            Category
          </label>
          <input
            id="task-category"
            name="category"
            list="task-categories"
            className={cn('input', errors.category && 'input-error')}
            placeholder="e.g. Work"
            value={values.category ?? ''}
            onChange={(e) => set('category', e.target.value)}
          />
          <datalist id="task-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <FieldError message={errors.category} />
        </div>
        <div>
          <label htmlFor="task-tags" className="label">
            Tags
          </label>
          <input
            id="task-tags"
            name="tags"
            list="task-tag-options"
            className={cn('input', errors.tags && 'input-error')}
            placeholder="Type and press Enter"
            value={tagDraft}
            onChange={(e) => {
              setTagDraft(e.target.value);
              if (errors.tags) setErrors((x) => ({ ...x, tags: undefined }));
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                addTag(tagDraft);
              } else if (e.key === 'Backspace' && !tagDraft && values.tags.length) {
                set('tags', values.tags.slice(0, -1));
              }
            }}
          />
          <datalist id="task-tag-options">
            {knownTags
              .filter((t) => !values.tags.includes(t))
              .map((t) => (
                <option key={t} value={t} />
              ))}
          </datalist>
          <FieldError message={errors.tags} />
        </div>
      </div>
      {values.tags.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {values.tags.map((tag) => (
            <TagChip key={tag} tag={tag} onRemove={() => set('tags', values.tags.filter((t) => t !== tag))} />
          ))}
        </div>
      )}

      <div>
        <span className="label">
          Subtasks{' '}
          {values.subtasks.length > 0 && <span className="font-normal text-slate-400">({values.subtasks.length})</span>}
        </span>
        {values.subtasks.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {values.subtasks.map((s, i) => (
              <li key={s.id} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  aria-label={`Subtask ${i + 1} completed`}
                  onChange={() =>
                    set(
                      'subtasks',
                      values.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)),
                    )
                  }
                  className="h-4 w-4 shrink-0 cursor-pointer rounded accent-violet-600"
                />
                <input
                  className="input h-9 flex-1"
                  value={s.title}
                  aria-label={`Subtask ${i + 1}`}
                  onChange={(e) =>
                    set(
                      'subtasks',
                      values.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-icon h-8 w-8 hover:text-rose-600"
                  aria-label={`Remove subtask ${i + 1}`}
                  onClick={() => set('subtasks', values.subtasks.filter((x) => x.id !== s.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            className="input h-9 flex-1"
            placeholder="Add a subtask and press Enter"
            aria-label="New subtask"
            value={subtaskDraft}
            onChange={(e) => setSubtaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                addSubtask();
              }
            }}
          />
          <button type="button" className="btn-secondary h-9" onClick={addSubtask} disabled={!subtaskDraft.trim()}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="task-notes" className="label">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="task-notes"
          name="notes"
          rows={3}
          className={cn('input h-auto resize-y py-2.5 leading-relaxed', errors.notes && 'input-error')}
          placeholder="Working notes, links, decisions…"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
        <FieldError message={errors.notes} />
      </div>
    </form>
  );
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
      {message}
    </p>
  );
}
