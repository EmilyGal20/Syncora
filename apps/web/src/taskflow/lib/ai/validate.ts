// @ts-nocheck
import type { Priority } from '../../types';
import { addDays, diffInDays, isValidISODate, parseISODate, toISODate } from '../date';
import { PRIORITIES, PRIORITY_META } from '../tasks';
import { isDeadlineInRange } from './deadline';
import { planError } from './errors';
import { truncateText } from '../utils';
import { PLAN_LIMITS } from './limits';
import type { DeadlineSource, Plan, PlanRequest, PlanResult, PlanSource, PlanSuggestion, PlanWarning } from './types';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

// C0/C1 controls plus bidi overrides, which could disguise text. Descriptions keep line breaks.
const CONTROL = /[\u0000-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;
const CONTROL_KEEP_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;
const LIST_MARKER = /^(?:[-*•‣◦·–—+>]+\s*|\d{1,3}[.)\]:]\s+|[a-z][.)]\s+|\[[ xX]?\]\s*)/iu;

export function stripControl(text: string, keepNewlines = false): string {
  return text.replace(keepNewlines ? CONTROL_KEEP_NEWLINE : CONTROL, keepNewlines ? '' : ' ');
}

const oneLine = (text: string) => stripControl(text).replace(/\s+/g, ' ').trim();

/**
 * Case- and punctuation-insensitive key used to spot duplicate titles. Titles made only of
 * symbols or emoji fall back to their normalized text so they are kept rather than dropped.
 */
export function titleKey(title: string): string {
  const lettersAndNumbers = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return lettersAndNumbers || title.toLowerCase().replace(/\s+/g, ' ').trim();
}

export type RequestValidation =
  | { ok: true; request: PlanRequest }
  | { ok: false; field: 'goal' | 'deadline'; message: string };

/** Checks the form input before anything is generated or sent. */
export function validateRequest(input: PlanRequest): RequestValidation {
  const goal = typeof input.goal === 'string' ? input.goal.trim() : '';
  if (goal.length < PLAN_LIMITS.goalMin) return { ok: false, field: 'goal', message: 'Describe your goal first.' };
  if (goal.length > PLAN_LIMITS.goalMax) return { ok: false, field: 'goal', message: 'Keep your goal under 500 characters.' };
  if (!isValidISODate(input.today)) return { ok: false, field: 'deadline', message: 'Pick today or a later date.' };
  let deadline: string | null = null;
  if (input.deadline !== null && input.deadline !== '') {
    if (!isValidISODate(input.deadline) || diffInDays(parseISODate(input.deadline), parseISODate(input.today)) < 0) {
      return { ok: false, field: 'deadline', message: 'Pick today or a later date.' };
    }
    if (!isDeadlineInRange(input.deadline, input.today)) {
      return { ok: false, field: 'deadline', message: 'Pick a date within the next year.' };
    }
    deadline = input.deadline;
  }
  const projectName = typeof input.projectName === 'string' ? oneLine(input.projectName).slice(0, PLAN_LIMITS.projectNameMax) : '';
  return {
    ok: true,
    request: {
      goal,
      deadline,
      projectId: typeof input.projectId === 'string' && input.projectId ? input.projectId : null,
      projectName: projectName || null,
      today: input.today,
    },
  };
}

export interface ValidateContext {
  id: string;
  source: PlanSource;
  providerLabel: string;
  goal: string;
  today: string;
  effectiveDeadline: string;
  deadlineSource: DeadlineSource;
}

interface Accepted {
  index: number;
  title: string;
  description: string;
  priority: Priority;
  estimateMinutes: number;
  dueDate: string | null;
  dateAdjusted: boolean;
  subtasks: string[];
}

function cleanTitle(value: string): { text: string; truncated: boolean } {
  let text = oneLine(value);
  // Strip repeated markers like "1. - Title".
  for (let i = 0; i < 3 && LIST_MARKER.test(text); i++) text = text.replace(LIST_MARKER, '').trim();
  const truncated = text.length > PLAN_LIMITS.titleMax;
  return { text: truncated ? truncateText(text, PLAN_LIMITS.titleMax).trim() : text, truncated };
}

function cleanEstimate(value: unknown): { minutes: number; repaired: boolean } {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return { minutes: PLAN_LIMITS.estimateDefault, repaired: value !== undefined };
  const step = PLAN_LIMITS.estimateStep;
  const minutes = Math.min(PLAN_LIMITS.estimateMax, Math.max(PLAN_LIMITS.estimateMin, Math.round(n / step) * step));
  return { minutes, repaired: n < PLAN_LIMITS.estimateMin || n > PLAN_LIMITS.estimateMax };
}

/**
 * Repairs or rejects provider output (demo included) so only safe, bounded data reaches the UI.
 * Text is kept as plain text; it is never interpreted as HTML.
 */
export function validatePlan(raw: unknown, ctx: ValidateContext): PlanResult {
  if (!isObj(raw) || !Array.isArray(raw.suggestions)) return { ok: false, error: planError('malformed') };
  if (raw.version !== undefined && raw.version !== 1) return { ok: false, error: planError('malformed') };
  if (!isValidISODate(ctx.today) || !isValidISODate(ctx.effectiveDeadline)) return { ok: false, error: planError('invalid_request') };

  const today = parseISODate(ctx.today);
  const deadline = parseISODate(ctx.effectiveDeadline);
  const span = Math.max(0, diffInDays(deadline, today));
  const warnings: PlanWarning[] = [];
  const seen = new Set<string>();
  const accepted: Accepted[] = [];
  const items = raw.suggestions;

  if (items.length > PLAN_LIMITS.scanItems) warnings.push({ code: 'too_many' });
  const scan = items.slice(0, PLAN_LIMITS.scanItems);

  for (let index = 0; index < scan.length; index++) {
    const item = scan[index];
    if (!isObj(item) || typeof item.title !== 'string') {
      warnings.push({ code: 'item_dropped', index });
      continue;
    }
    const title = cleanTitle(item.title);
    if (!title.text) {
      warnings.push({ code: 'item_dropped', index });
      continue;
    }
    const key = titleKey(title.text);
    if (!key || seen.has(key)) {
      warnings.push({ code: key ? 'duplicate_removed' : 'item_dropped', index });
      continue;
    }
    if (accepted.length >= PLAN_LIMITS.maxSuggestions) {
      if (!warnings.some((w) => w.code === 'too_many')) warnings.push({ code: 'too_many' });
      break;
    }
    seen.add(key);
    if (title.truncated) warnings.push({ code: 'text_truncated', index });

    let description = typeof item.description === 'string' ? stripControl(item.description, true).trim() : '';
    if (description.length > PLAN_LIMITS.descriptionMax) {
      description = truncateText(description, PLAN_LIMITS.descriptionMax).trim();
      warnings.push({ code: 'text_truncated', index });
    }

    const rawPriority = typeof item.priority === 'string' ? item.priority.trim().toLowerCase() : '';
    const priority = PRIORITIES.includes(rawPriority as Priority) ? (rawPriority as Priority) : 'medium';
    if (item.priority !== undefined && priority !== rawPriority) warnings.push({ code: 'field_repaired', index });

    const estimate = cleanEstimate(item.estimateMinutes);
    if (estimate.repaired) warnings.push({ code: 'field_repaired', index });

    let dueDate: string | null = null;
    let dateAdjusted = false;
    if (isValidISODate(item.dueDate)) {
      const d = parseISODate(item.dueDate);
      if (diffInDays(d, today) < 0) {
        dueDate = ctx.today;
        dateAdjusted = true;
      } else if (diffInDays(d, deadline) > 0) {
        dueDate = ctx.effectiveDeadline;
        dateAdjusted = true;
      } else {
        dueDate = item.dueDate;
      }
    } else if (item.dueDate !== undefined && item.dueDate !== null) {
      // Present but unusable: it gets a spread date below and is flagged as moved.
      dateAdjusted = true;
    }
    if (dateAdjusted) warnings.push({ code: 'date_adjusted', index });

    const subtasks: string[] = [];
    const subKeys = new Set<string>();
    let subtasksCapped = false;
    if (Array.isArray(item.subtasks)) {
      for (const s of item.subtasks.slice(0, PLAN_LIMITS.scanItems)) {
        if (typeof s !== 'string') continue;
        const text = truncateText(cleanTitle(s).text, PLAN_LIMITS.subtaskMax).trim();
        const k = titleKey(text);
        if (!text || !k || subKeys.has(k)) continue;
        if (subtasks.length >= PLAN_LIMITS.providerSubtasks) {
          subtasksCapped = true;
          break;
        }
        subKeys.add(k);
        subtasks.push(text);
      }
    }
    if (subtasksCapped) warnings.push({ code: 'subtasks_capped', index });

    accepted.push({ index, title: title.text, description, priority, estimateMinutes: estimate.minutes, dueDate, dateAdjusted, subtasks });
  }

  if (!accepted.length) return { ok: false, error: planError('empty') };

  // Items without a usable date are spread evenly between today and the deadline.
  const undated = accepted.filter((a) => a.dueDate === null);
  undated.forEach((a, i) => {
    const offset = Math.round((span * (i + 1)) / undated.length);
    a.dueDate = toISODate(addDays(today, offset));
  });

  const sorted = [...accepted].sort(
    (a, b) =>
      a.dueDate!.localeCompare(b.dueDate!) ||
      PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank ||
      a.index - b.index,
  );

  const suggestions: PlanSuggestion[] = sorted.map((a, i) => ({
    key: `s${i}`,
    title: a.title,
    description: a.description,
    priority: a.priority,
    estimateMinutes: a.estimateMinutes,
    dueDate: a.dueDate!,
    subtasks: a.subtasks,
    dateAdjusted: a.dateAdjusted,
  }));

  const plan: Plan = {
    id: ctx.id,
    source: ctx.source,
    providerLabel: ctx.providerLabel,
    goal: ctx.goal,
    effectiveDeadline: ctx.effectiveDeadline,
    deadlineSource: ctx.deadlineSource,
    suggestions,
    warnings,
  };
  return { ok: true, plan };
}

/** Short note for the UI, e.g. "2 suggestions were adjusted · 1 was removed". */
export function summarizeWarnings(warnings: PlanWarning[]): string | null {
  const adjusted = new Set<number>();
  const removed = new Set<number>();
  let truncatedList = false;
  for (const w of warnings) {
    if (w.code === 'too_many') truncatedList = true;
    else if (w.index === undefined) continue;
    else if (w.code === 'item_dropped' || w.code === 'duplicate_removed') removed.add(w.index);
    else adjusted.add(w.index);
  }
  const parts: string[] = [];
  if (adjusted.size) parts.push(`${adjusted.size} ${adjusted.size === 1 ? 'suggestion was' : 'suggestions were'} adjusted`);
  if (removed.size) parts.push(`${removed.size} ${removed.size === 1 ? 'was' : 'were'} removed`);
  if (truncatedList) parts.push(`only the first ${PLAN_LIMITS.maxSuggestions} are shown`);
  return parts.length ? parts.join(' · ') : null;
}
