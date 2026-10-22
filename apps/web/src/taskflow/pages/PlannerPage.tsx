// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, SearchX, Sparkles } from 'lucide-react';
import { useDataActions, useDataState } from '../store/DataContext';
import { useClock, useUIActions } from '../store/UIContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { PlannerForm, type PlannerFormErrors } from '../components/planner/PlannerForm';
import { SourceBadge } from '../components/planner/SourceBadge';
import { SuggestionCard } from '../components/planner/SuggestionCard';
import { draftToSuggestion, isDraftValid, toDraft, type Draft, type DraftPatch } from '../components/planner/draft';
import {
  PLAN_LIMITS,
  formatEstimate,
  getActiveProvider,
  resolvePlannerConfig,
  suggestionToTaskInput,
  validateRequest,
  type Plan,
  type PlanError,
} from '../lib/ai';
import { toISODate } from '../lib/date';
import { pluralize } from '../lib/utils';

// Demo unless a (non-secret) endpoint is configured at build time.
const provider = getActiveProvider(resolvePlannerConfig(import.meta.env));

type View =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'error'; error: PlanError }
  | { kind: 'empty' }
  | { kind: 'plan'; plan: Plan }
  | { kind: 'saved'; count: number; projectId: string | null; projectName: string | null };

type FocusTarget = 'heading' | 'retry' | 'saved' | 'goal' | 'deadline' | { checkbox: string };

/** Resolves true after `ms`, or false as soon as the signal aborts. */
function abortableDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function PlannerPage() {
  const { projects } = useDataState();
  const { createTasks, bulkDelete, getState } = useDataActions();
  const { navigate } = useUIActions();
  const toast = useToast();
  const confirm = useConfirm();
  const today = toISODate(useClock());

  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [projectId, setProjectId] = useState('');
  const [errors, setErrors] = useState<PlannerFormErrors>({});
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [announcement, setAnnouncement] = useState('');

  const goalRef = useRef<HTMLTextAreaElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);
  const savingRef = useRef(false);
  const planIdRef = useRef<string | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const pendingFocus = useRef<FocusTarget | null>(null);

  // Abort any request in flight when leaving the page.
  useEffect(
    () => () => {
      requestIdRef.current++;
      abortRef.current?.abort();
    },
    [],
  );

  // Move focus once the element it targets has rendered.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (typeof target === 'object') {
      document.getElementById(`plan-include-${target.checkbox}`)?.focus();
      return;
    }
    const el = { heading: headingRef, retry: retryRef, saved: savedRef, goal: goalRef, deadline: deadlineRef }[target].current;
    el?.focus();
  });

  const focusSoon = (target: FocusTarget) => {
    pendingFocus.current = target;
  };

  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const hasPlan = view.kind === 'plan';

  useEffect(() => {
    document.body.classList.toggle('has-save-bar', hasPlan);
    return () => document.body.classList.remove('has-save-bar');
  }, [hasPlan]);

  const generate = async () => {
    if (generatingRef.current) return;
    const checked = validateRequest({
      goal,
      deadline: deadline || null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      today,
    });
    if (!checked.ok) {
      setErrors({ [checked.field]: checked.message });
      (checked.field === 'goal' ? goalRef : deadlineRef).current?.focus();
      return;
    }
    setErrors({});
    if (view.kind === 'plan') {
      const discard = await confirm({
        title: 'Discard this plan?',
        message: 'Your proposed tasks haven’t been added yet.',
        confirmLabel: 'Discard',
      });
      if (!discard || generatingRef.current) return;
    }

    generatingRef.current = true;
    const id = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    planIdRef.current = null;
    setDrafts([]);
    setView({ kind: 'generating' });
    setAnnouncement('Generating plan…');

    try {
      // The demo answers instantly; a short pause keeps the loading state from flashing.
      if (provider.source === 'demo' && !(await abortableDelay(PLAN_LIMITS.demoDelayMs, controller.signal))) return;
      const result = await provider.generate(checked.request, controller.signal);
      if (id !== requestIdRef.current || controller.signal.aborted) return;

      if (!result.ok) {
        if (result.error.kind === 'aborted') {
          setView({ kind: 'idle' });
          setAnnouncement('');
        } else if (result.error.kind === 'empty') {
          setView({ kind: 'empty' });
          setAnnouncement('No tasks suggested.');
          focusSoon('goal');
        } else {
          setView({ kind: 'error', error: result.error });
          setAnnouncement(result.error.message);
          focusSoon('retry');
        }
        return;
      }

      const plan = result.plan;
      savingRef.current = false;
      planIdRef.current = plan.id;
      setDrafts(plan.suggestions.map((s) => toDraft(s, plan.id)));
      setView({ kind: 'plan', plan });
      setAnnouncement(
        `${pluralize(plan.suggestions.length, 'task')} suggested. ${
          plan.source === 'demo' ? 'Demo plan, not AI-generated.' : 'AI-generated plan, review before adding.'
        }`,
      );
      focusSoon('heading');
    } finally {
      if (id === requestIdRef.current) generatingRef.current = false;
    }
  };

  const resetPlan = (focusGoal: boolean) => {
    planIdRef.current = null;
    setDrafts([]);
    setView({ kind: 'idle' });
    setAnnouncement('');
    if (focusGoal) focusSoon('goal');
  };

  const newPlan = async () => {
    if (view.kind === 'plan') {
      const discard = await confirm({
        title: 'Discard this plan?',
        message: 'Your proposed tasks haven’t been added yet.',
        confirmLabel: 'Discard',
      });
      if (!discard) return;
    }
    resetPlan(true);
  };

  const updateDraft = useCallback((key: string, patch: DraftPatch) => {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }, []);

  const removeDraft = useCallback(
    (key: string) => {
      const list = draftsRef.current;
      const index = list.findIndex((d) => d.key === key);
      if (index < 0) return;
      const removed = list[index];
      const neighbour = list[index + 1] ?? list[index - 1];
      setDrafts((l) => l.filter((d) => d.key !== key));
      pendingFocus.current = neighbour ? { checkbox: neighbour.key } : 'heading';
      const planId = planIdRef.current;
      toast({
        title: 'Suggestion removed',
        tone: 'info',
        action: {
          label: 'Undo',
          onClick: () => {
            // A newer plan (or a saved one) replaced this list in the meantime.
            if (planIdRef.current !== planId) return;
            setDrafts((l) => (l.some((d) => d.key === key) ? l : [...l.slice(0, index), removed, ...l.slice(index)]));
          },
        },
      });
    },
    [toast],
  );

  const validSelected = useMemo(() => drafts.filter((d) => d.selected && isDraftValid(d)), [drafts]);
  const selectedCount = useMemo(() => drafts.filter((d) => d.selected).length, [drafts]);
  const totalMinutes = validSelected.reduce((sum, d) => sum + d.estimateMinutes, 0);
  const allSelected = drafts.length > 0 && selectedCount === drafts.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected, view.kind]);

  const toggleAll = () => setDrafts((list) => list.map((d) => ({ ...d, selected: !allSelected })));

  const save = () => {
    if (savingRef.current || view.kind !== 'plan') return;
    const chosen = draftsRef.current.filter((d) => d.selected && isDraftValid(d));
    if (!chosen.length) return;
    savingRef.current = true;

    const plan = view.plan;
    // The project may have been deleted while the plan was open.
    const target = projectId ? getState().projects.find((p) => p.id === projectId) ?? null : null;
    const inputs = chosen.map((d) =>
      suggestionToTaskInput(draftToSuggestion(d), { projectId: target?.id ?? null, goal: plan.goal, source: plan.source }),
    );
    const created = createTasks(inputs, `Created ${pluralize(inputs.length, 'task')} from AI Planner`);
    const ids = created.map((t) => t.id);
    const label = pluralize(created.length, 'task');

    // Clearing the plan in the same handler means it can never be added twice.
    planIdRef.current = null;
    setDrafts([]);
    setView({ kind: 'saved', count: created.length, projectId: target?.id ?? null, projectName: target?.name ?? null });
    setGoal('');
    setAnnouncement(`${label} added to My Tasks.`);
    focusSoon('saved');
    toast({
      tone: 'success',
      title: `${label} added`,
      description: `From ${plan.source === 'demo' ? 'a demo' : 'an AI'} plan${target ? ` · in ${target.name}` : ''}`,
      action: {
        label: 'Undo',
        onClick: () => {
          const removed = bulkDelete(ids);
          // If the success panel is still showing, go back to an empty planner (no-op after leaving the page).
          setView((v) => (v.kind === 'saved' ? { kind: 'idle' } : v));
          setAnnouncement(removed.length ? `Removed ${pluralize(removed.length, 'task')}.` : '');
          toast({ tone: 'info', title: removed.length ? `Removed ${pluralize(removed.length, 'task')}` : 'Nothing to undo' });
        },
      },
    });
  };

  const viewTasks = () => {
    if (view.kind !== 'saved') return;
    const exists = view.projectId && getState().projects.some((p) => p.id === view.projectId);
    navigate(exists ? { name: 'project', id: view.projectId! } : { name: 'tasks' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="AI Planner"
        description="Turn a goal into a list of tasks you can review before adding."
        actions={
          hasPlan ? (
            <button type="button" className="btn-ghost" onClick={() => void newPlan()}>
              <RotateCcw className="h-4 w-4" aria-hidden /> New plan
            </button>
          ) : undefined
        }
      />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <PlannerForm
        goal={goal}
        deadline={deadline}
        projectId={projectId}
        projects={projects}
        today={today}
        errors={errors}
        generating={view.kind === 'generating'}
        hasPlan={hasPlan}
        goalRef={goalRef}
        deadlineRef={deadlineRef}
        onGoalChange={(v) => {
          setGoal(v);
          if (errors.goal) setErrors((e) => ({ ...e, goal: undefined }));
        }}
        onDeadlineChange={(v) => {
          setDeadline(v);
          if (errors.deadline) setErrors((e) => ({ ...e, deadline: undefined }));
        }}
        onProjectChange={setProjectId}
        onGenerate={() => void generate()}
      />

      <div className="mt-6">
        {view.kind === 'idle' && (
          <div className="card">
            <EmptyState
              icon={Sparkles}
              title="Plan from a goal"
              description="Describe what you want to achieve and we'll suggest tasks. You review and choose what to add — nothing is saved until you do."
            />
          </div>
        )}

        {view.kind === 'generating' && (
          <div aria-hidden className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-6 flex-1" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:pl-8 lg:grid-cols-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="col-span-2 h-10 lg:col-span-1" />
                </div>
              </div>
            ))}
          </div>
        )}

        {view.kind === 'error' && (
          <div className="card">
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't generate a plan"
              description={view.error.message}
              action={
                <button ref={retryRef} type="button" className="btn-primary h-10" onClick={() => void generate()}>
                  <RotateCcw className="h-4 w-4" aria-hidden /> Try again
                </button>
              }
            />
          </div>
        )}

        {view.kind === 'empty' && (
          <div className="card">
            <EmptyState
              icon={SearchX}
              title="No tasks suggested"
              description="Try describing your goal in a different way."
              action={
                <button type="button" className="btn-secondary h-10" onClick={() => goalRef.current?.focus()}>
                  Edit goal
                </button>
              }
            />
          </div>
        )}

        {view.kind === 'saved' && (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <h2 ref={savedRef} tabIndex={-1} className="section-title focus:outline-none">
              {pluralize(view.count, 'task')} added
            </h2>
            <p className="mt-1 text-[13px] muted">
              {view.count === 1 ? 'It’s' : 'They’re'} in My Tasks{view.projectName ? ` · in ${view.projectName}` : ''}.
            </p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button type="button" className="btn-primary h-10" onClick={viewTasks}>
                View tasks
              </button>
              <button type="button" className="btn-secondary h-10" onClick={() => resetPlan(true)}>
                Plan something else
              </button>
            </div>
          </div>
        )}

        {view.kind === 'plan' && (
          <section aria-labelledby="planner-results-title">
            <SourceBadge plan={view.plan} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h2 id="planner-results-title" ref={headingRef} tabIndex={-1} className="section-title focus:outline-none">
                Proposed tasks
              </h2>
              {drafts.length > 0 && (
                <label className="-mr-2 flex h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.05]">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer accent-violet-600 dark:accent-violet-500"
                  />
                  {someSelected ? `${selectedCount} of ${drafts.length} selected` : `Select all (${drafts.length})`}
                </label>
              )}
            </div>

            {drafts.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {drafts.map((d, i) => (
                  <SuggestionCard
                    key={d.key}
                    draft={d}
                    index={i}
                    total={drafts.length}
                    deadline={view.plan.effectiveDeadline}
                    onChange={updateDraft}
                    onRemove={removeDraft}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[13px] muted dark:border-white/10">
                You removed every suggestion. Undo from the notification or generate a new plan.
              </p>
            )}

            <div
              role="region"
              aria-label="Add selected tasks"
              className="sticky bottom-4 z-20 mt-4 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:pl-4 dark:border-white/10 dark:bg-ink-800/95"
            >
              <p className="px-2 text-[13px] font-medium text-slate-700 sm:px-0 dark:text-slate-200">
                {validSelected.length
                  ? `${validSelected.length} of ${drafts.length} selected · ~${formatEstimate(totalMinutes)}`
                  : 'No tasks selected'}
              </p>
              <button type="button" className="btn-primary h-10 w-full sm:w-auto" disabled={!validSelected.length} onClick={save}>
                {`Add ${pluralize(validSelected.length, 'task')}`}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
