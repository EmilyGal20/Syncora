// @ts-nocheck
import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import type { Project } from '../../types';
import { PLAN_LIMITS } from '../../lib/ai';
import { addDays, parseISODate, toISODate } from '../../lib/date';
import { cn } from '../../lib/utils';

export interface PlannerFormErrors {
  goal?: string;
  deadline?: string;
}

interface PlannerFormProps {
  goal: string;
  deadline: string;
  projectId: string;
  projects: Project[];
  today: string;
  errors: PlannerFormErrors;
  generating: boolean;
  hasPlan: boolean;
  goalRef: RefObject<HTMLTextAreaElement>;
  deadlineRef: RefObject<HTMLInputElement>;
  onGoalChange: (value: string) => void;
  onDeadlineChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onGenerate: () => void;
}

export function PlannerForm({
  goal,
  deadline,
  projectId,
  projects,
  today,
  errors,
  generating,
  hasPlan,
  goalRef,
  deadlineRef,
  onGoalChange,
  onDeadlineChange,
  onProjectChange,
  onGenerate,
}: PlannerFormProps) {
  const base = parseISODate(today);
  const chips = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: toISODate(addDays(base, 1)) },
    { label: 'Next week', value: toISODate(addDays(base, 7)) },
  ];
  const length = goal.length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!generating) onGenerate();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!generating) onGenerate();
    }
  };

  return (
    <form className="card p-4 sm:p-5" onSubmit={submit} onKeyDown={onKeyDown} noValidate aria-label="Plan a goal">
      <label htmlFor="planner-goal" className="label">
        What do you want to get done?
      </label>
      <textarea
        id="planner-goal"
        ref={goalRef}
        rows={3}
        value={goal}
        maxLength={PLAN_LIMITS.goalMax + 20}
        onChange={(e) => onGoalChange(e.target.value)}
        placeholder="e.g. I want to finish my project by Thursday."
        className={cn('input h-auto min-h-[88px] resize-y py-2.5 leading-relaxed', errors.goal && 'input-error')}
        aria-invalid={errors.goal ? true : undefined}
        aria-describedby={cn(errors.goal && 'planner-goal-error', 'planner-goal-count') || undefined}
      />
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {errors.goal && (
            <p id="planner-goal-error" role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {errors.goal}
            </p>
          )}
        </div>
        <span
          id="planner-goal-count"
          className={cn(
            'shrink-0 text-xs tabular-nums',
            length >= PLAN_LIMITS.goalMax ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500',
          )}
        >
          {length} / {PLAN_LIMITS.goalMax}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="planner-deadline" className="label">
            Deadline <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <input
            id="planner-deadline"
            ref={deadlineRef}
            type="date"
            min={today}
            value={deadline}
            onChange={(e) => onDeadlineChange(e.target.value)}
            className={cn('input', errors.deadline && 'input-error')}
            aria-invalid={errors.deadline ? true : undefined}
            aria-describedby={errors.deadline ? 'planner-deadline-error' : undefined}
          />
          {errors.deadline && (
            <p id="planner-deadline-error" role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
              {errors.deadline}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick deadlines">
            {chips.map((chip) => {
              const active = deadline === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onDeadlineChange(active ? '' : chip.value)}
                  className={cn(
                    'h-10 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                    active
                      ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/30'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-white/[0.03] dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/[0.07] dark:hover:text-white',
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="planner-project" className="label">
            Add to project <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <div className="relative">
            <select
              id="planner-project"
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="input cursor-pointer appearance-none truncate pr-8"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <span className="hidden items-center gap-1 text-xs muted sm:inline-flex">
          <kbd className="kbd">Ctrl</kbd>
          <kbd className="kbd">Enter</kbd>
          <span className="ml-1">to generate</span>
        </span>
        <button type="submit" className="btn-primary h-10 w-full sm:w-auto" disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {generating ? 'Generating…' : hasPlan ? 'Regenerate' : 'Generate plan'}
        </button>
      </div>
    </form>
  );
}
