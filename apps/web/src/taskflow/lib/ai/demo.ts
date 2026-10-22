// @ts-nocheck
import type { Priority } from '../../types';
import { addDays, diffInDays, parseISODate, toISODate } from '../date';
import { classifyGoal, extractTopic } from './classify';
import { resolveDeadline } from './deadline';
import { planError } from './errors';
import { PLAN_LIMITS } from './limits';
import { TEMPLATES, titleWithTopic } from './templates';
import type { PlanProvider, PlanRequest, PlanResult } from './types';
import { validatePlan, validateRequest } from './validate';

export const DEMO_PROVIDER_LABEL = 'Demo plan';

const ESCALATE: Record<Priority, Priority> = { low: 'medium', medium: 'high', high: 'urgent', urgent: 'urgent' };

export interface RawDemoPlan {
  version: 1;
  suggestions: {
    title: string;
    description: string;
    priority: Priority;
    estimateMinutes: number;
    dueDate: string;
    subtasks: string[];
  }[];
}

/**
 * Builds a plan from fixed templates. Deterministic: the same request always gives the same
 * output (no randomness, no clock). Its output still goes through validatePlan like any provider's.
 */
export function generateDemoPlan(request: PlanRequest): RawDemoPlan {
  const { date: deadline } = resolveDeadline(request);
  const today = parseISODate(request.today);
  const span = Math.max(0, diffInDays(parseISODate(deadline), today));
  const topic = extractTopic(request.goal);
  let steps = TEMPLATES[classifyGoal(request.goal)];
  const dueToday = span === 0;
  const urgent = span <= 2;

  if (dueToday && steps.length > 4) {
    // Keep the opening steps and the final delivery step.
    steps = [...steps.slice(0, 3), steps[steps.length - 1]];
  }

  return {
    version: 1,
    suggestions: steps.map((step) => {
      const halved = Math.round(step.estimateMinutes / 2 / PLAN_LIMITS.estimateStep) * PLAN_LIMITS.estimateStep;
      return {
        title: titleWithTopic(step.title, topic),
        description: step.description,
        priority: urgent ? ESCALATE[step.priority] : step.priority,
        estimateMinutes: dueToday ? Math.max(PLAN_LIMITS.estimateMin, halved) : step.estimateMinutes,
        dueDate: toISODate(addDays(today, Math.round(step.offset * span))),
        subtasks: [...step.subtasks],
      };
    }),
  };
}

let planSeq = 0;

export const demoProvider: PlanProvider = {
  id: 'demo',
  source: 'demo',
  label: DEMO_PROVIDER_LABEL,
  async generate(input: PlanRequest, signal?: AbortSignal): Promise<PlanResult> {
    if (signal?.aborted) return { ok: false, error: planError('aborted') };
    const checked = validateRequest(input);
    if (!checked.ok) return { ok: false, error: planError('invalid_request') };
    const request = checked.request;
    const { date, source } = resolveDeadline(request);
    return validatePlan(generateDemoPlan(request), {
      id: `plan_${++planSeq}`,
      source: 'demo',
      providerLabel: DEMO_PROVIDER_LABEL,
      goal: request.goal,
      today: request.today,
      effectiveDeadline: date,
      deadlineSource: source,
    });
  },
};
