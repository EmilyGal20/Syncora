// @ts-nocheck
import type { Priority } from '../../types';
import type { PlanSuggestion } from '../../lib/ai';
import { uid } from '../../lib/utils';

export interface DraftSubtask {
  id: string;
  title: string;
}

/** An editable proposal. Nothing here is stored until the user adds it. */
export interface Draft {
  key: string;
  title: string;
  description: string;
  priority: Priority;
  estimateMinutes: number;
  /** YYYY-MM-DD, or '' when the user cleared it. */
  dueDate: string;
  subtasks: DraftSubtask[];
  dateAdjusted: boolean;
  selected: boolean;
}

export type DraftPatch = Partial<Omit<Draft, 'key'>>;

export function toDraft(s: PlanSuggestion, planId: string): Draft {
  return {
    key: `${planId}-${s.key}`,
    title: s.title,
    description: s.description,
    priority: s.priority,
    estimateMinutes: s.estimateMinutes,
    dueDate: s.dueDate,
    subtasks: s.subtasks.map((title) => ({ id: uid('ds_'), title })),
    dateAdjusted: s.dateAdjusted,
    selected: true,
  };
}

export const isDraftValid = (d: Draft) => d.title.trim().length > 0;

export function draftToSuggestion(d: Draft): PlanSuggestion {
  return {
    key: d.key,
    title: d.title.trim(),
    description: d.description,
    priority: d.priority,
    estimateMinutes: d.estimateMinutes,
    dueDate: d.dueDate,
    subtasks: d.subtasks.map((s) => s.title.trim()).filter(Boolean),
    dateAdjusted: d.dateAdjusted,
  };
}
