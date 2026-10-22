// @ts-nocheck
import { memo, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import type { Priority } from '../../types';
import { ESTIMATE_OPTIONS, PLAN_LIMITS, formatEstimate } from '../../lib/ai';
import { PRIORITIES, PRIORITY_META } from '../../lib/tasks';
import { cn, uid } from '../../lib/utils';
import type { Draft, DraftPatch } from './draft';

interface SuggestionCardProps {
  draft: Draft;
  index: number;
  total: number;
  deadline: string;
  onChange: (key: string, patch: DraftPatch) => void;
  onRemove: (key: string) => void;
}

const selectClass = 'input cursor-pointer appearance-none pr-8 text-[13px]';
const smallLabel = 'mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400';

/** One editable proposal. Memoized: the page passes stable callbacks and per-card data only. */
export const SuggestionCard = memo(function SuggestionCard({ draft, index, total, deadline, onChange, onRemove }: SuggestionCardProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  const focusAdd = useRef(false);
  const key = draft.key;
  const titleMissing = !draft.title.trim();
  const displayTitle = draft.title.trim() || 'Untitled';
  const afterDeadline = !!draft.dueDate && draft.dueDate > deadline;
  const subCount = draft.subtasks.length;
  const canAddSub = subCount < PLAN_LIMITS.editSubtasks;

  useEffect(() => {
    if (open && focusAdd.current) {
      focusAdd.current = false;
      addInputRef.current?.focus();
    }
  }, [open]);

  const addSubtask = () => {
    const title = subDraft.trim().slice(0, PLAN_LIMITS.subtaskMax);
    if (!title || !canAddSub) return;
    onChange(key, { subtasks: [...draft.subtasks, { id: uid('ds_'), title }] });
    setSubDraft('');
  };

  const dueNotes = [draft.dateAdjusted && `${id}-adjusted`, afterDeadline && `${id}-late`].filter(Boolean).join(' ');
  // A provider may suggest a valid estimate that isn't a preset (e.g. 75 min); offer it rather than changing it.
  const estimateOptions = ESTIMATE_OPTIONS.includes(draft.estimateMinutes as (typeof ESTIMATE_OPTIONS)[number])
    ? [...ESTIMATE_OPTIONS]
    : [...ESTIMATE_OPTIONS, draft.estimateMinutes].sort((a, b) => a - b);

  return (
    // The <li> keeps its list-item role so screen readers announce "item N of M"; the group is inside.
    <li className={cn('card p-3 transition-opacity sm:p-4', !draft.selected && 'opacity-60')}>
      <div role="group" aria-label={`Suggestion ${index + 1} of ${total}: ${displayTitle}`}>
        <div className="flex items-start gap-1.5 sm:gap-2">
          <label className="-ml-1 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.05]">
            <input
              id={`plan-include-${key}`}
              type="checkbox"
              checked={draft.selected}
              onChange={(e) => onChange(key, { selected: e.target.checked })}
              aria-label={`Include “${displayTitle}”`}
              className="h-4 w-4 cursor-pointer rounded accent-violet-600 dark:accent-violet-500"
            />
          </label>
          <div className="min-w-0 flex-1">
            <input
              value={draft.title}
              maxLength={PLAN_LIMITS.titleMax}
              onChange={(e) => onChange(key, { title: e.target.value })}
              aria-label={`Title of suggestion ${index + 1}`}
              aria-invalid={titleMissing || undefined}
              aria-describedby={titleMissing ? `${id}-title-error` : undefined}
              className={cn('input h-10 font-medium', titleMissing && 'input-error')}
            />
            {titleMissing && (
              <p id={`${id}-title-error`} role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                Add a title
              </p>
            )}
            {/* Everything that will be saved is visible and editable before the user approves it. */}
            <textarea
              value={draft.description}
              maxLength={PLAN_LIMITS.descriptionMax}
              onChange={(e) => onChange(key, { description: e.target.value })}
              rows={draft.description ? 2 : 1}
              placeholder="Add a description (optional)"
              aria-label={`Description of suggestion ${index + 1}`}
              className="mt-1.5 w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] leading-relaxed text-slate-600 outline-none transition placeholder:text-slate-400 hover:border-slate-200 focus:border-violet-400 focus:bg-white dark:text-slate-300 dark:hover:border-white/10 dark:focus:bg-white/[0.03]"
            />
          </div>
          <button type="button" className="btn-icon h-10 w-10" onClick={() => onRemove(key)} aria-label={`Remove “${displayTitle}”`}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:pl-10 lg:grid-cols-3">
          <div className="min-w-0">
            <label htmlFor={`${id}-priority`} className={smallLabel}>
              Priority
            </label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: PRIORITY_META[draft.priority].color }}
              />
              <select
                id={`${id}-priority`}
                value={draft.priority}
                onChange={(e) => onChange(key, { priority: e.target.value as Priority })}
                className={cn(selectClass, 'pl-7')}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${id}-estimate`} className={smallLabel}>
              Estimate
            </label>
            <div className="relative">
              <select
                id={`${id}-estimate`}
                value={draft.estimateMinutes}
                onChange={(e) => onChange(key, { estimateMinutes: Number(e.target.value) })}
                className={selectClass}
              >
                {estimateOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatEstimate(m)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            </div>
          </div>
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <label htmlFor={`${id}-due`} className={smallLabel}>
              Due date
            </label>
            <input
              id={`${id}-due`}
              type="date"
              value={draft.dueDate}
              onChange={(e) => onChange(key, { dueDate: e.target.value, dateAdjusted: false })}
              aria-describedby={dueNotes || undefined}
              className="input text-[13px]"
            />
            {draft.dateAdjusted && (
              <p id={`${id}-adjusted`} className="mt-1 text-xs muted">
                Date adjusted
              </p>
            )}
            {afterDeadline && (
              <p id={`${id}-late`} className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                After your deadline
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 sm:pl-10">
          {subCount === 0 && !open ? (
            <button
              type="button"
              className="btn-ghost btn-sm -ml-2 h-10"
              onClick={() => {
                focusAdd.current = true;
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add subtasks
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost btn-sm -ml-2 h-10"
              aria-expanded={open}
              aria-controls={`${id}-subtasks`}
              onClick={() => setOpen((o) => !o)}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} aria-hidden />
              Subtasks ({subCount})
            </button>
          )}
          <div id={`${id}-subtasks`} hidden={!open} className="mt-1 space-y-1.5">
            {subCount > 0 && (
              <ul className="space-y-1.5">
                {draft.subtasks.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1.5">
                    <input
                      value={s.title}
                      maxLength={PLAN_LIMITS.subtaskMax}
                      onChange={(e) =>
                        onChange(key, { subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })
                      }
                      aria-label={`Subtask ${i + 1}`}
                      className="input h-10 text-[13px]"
                    />
                    <button
                      type="button"
                      className="btn-icon h-10 w-10"
                      aria-label={`Remove subtask ${i + 1}`}
                      onClick={() => onChange(key, { subtasks: draft.subtasks.filter((x) => x.id !== s.id) })}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {canAddSub && (
              <input
                ref={addInputRef}
                value={subDraft}
                maxLength={PLAN_LIMITS.subtaskMax}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a subtask and press Enter"
                aria-label={`New subtask for suggestion ${index + 1}`}
                className="input h-10 text-[13px]"
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
});
