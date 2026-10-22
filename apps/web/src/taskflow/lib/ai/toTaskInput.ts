// @ts-nocheck
import type { TaskInput } from '../../types';
import { truncateText, uid } from '../utils';
import { PLAN_LIMITS } from './limits';
import type { PlanSource, PlanSuggestion } from './types';

/** "1h 30m", "45m" or "2h". The fixed format lets a future migration parse it back. */
export function formatEstimate(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export interface SuggestionContext {
  projectId: string | null;
  goal: string;
  source: PlanSource;
}

export const AI_PLAN_TAG = 'ai-plan';

/** Turns an approved suggestion into a regular task. */
export function suggestionToTaskInput(s: PlanSuggestion, ctx: SuggestionContext): TaskInput {
  const goal = truncateText(ctx.goal.trim().replace(/\s+/g, ' '), PLAN_LIMITS.goalInDescription);
  const footer = `Estimated time: ${formatEstimate(s.estimateMinutes)}\nPlanned with AI Planner (${ctx.source === 'demo' ? 'demo' : 'AI'}) from goal: "${goal}"`;
  const description = s.description.trim() ? `${s.description.trim()}\n\n${footer}` : footer;
  return {
    title: truncateText(s.title.trim(), PLAN_LIMITS.titleMax),
    description,
    status: 'todo',
    priority: s.priority,
    dueDate: s.dueDate || null,
    dueTime: null,
    projectId: ctx.projectId,
    category: null,
    tags: [AI_PLAN_TAG],
    subtasks: s.subtasks
      .map((t) => truncateText(t.trim(), PLAN_LIMITS.subtaskMax))
      .filter(Boolean)
      .map((title) => ({ id: uid('s_'), title, done: false })),
    notes: '',
    recurrence: null,
  };
}
