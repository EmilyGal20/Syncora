// @ts-nocheck
import type { Priority } from '../../types';

export type GoalKind = 'project' | 'study' | 'writing' | 'event' | 'trip' | 'generic';

export type PlanSource = 'demo' | 'ai';

export type DeadlineSource = 'explicit' | 'parsed' | 'default';

export interface PlanRequest {
  goal: string;
  /** Explicit deadline chosen in the form (YYYY-MM-DD), or null. */
  deadline: string | null;
  /** Kept on the client only; never sent to a server. */
  projectId: string | null;
  projectName: string | null;
  /** The user's local calendar date (YYYY-MM-DD). */
  today: string;
}

export interface PlanSuggestion {
  key: string;
  title: string;
  description: string;
  priority: Priority;
  estimateMinutes: number;
  dueDate: string;
  subtasks: string[];
  /** The provider's date was outside [today, deadline] (or invalid) and was moved. */
  dateAdjusted: boolean;
}

export type PlanWarningCode =
  | 'item_dropped'
  | 'duplicate_removed'
  | 'too_many'
  | 'text_truncated'
  | 'field_repaired'
  | 'date_adjusted'
  | 'subtasks_capped';

export interface PlanWarning {
  code: PlanWarningCode;
  /** Index of the raw item the warning is about, when it concerns one item. */
  index?: number;
}

export interface Plan {
  id: string;
  source: PlanSource;
  providerLabel: string;
  goal: string;
  effectiveDeadline: string;
  deadlineSource: DeadlineSource;
  suggestions: PlanSuggestion[];
  warnings: PlanWarning[];
}

export type PlanErrorKind =
  | 'invalid_request'
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'rate_limited'
  | 'http'
  | 'too_large'
  | 'malformed'
  | 'empty';

export interface PlanError {
  kind: PlanErrorKind;
  /** Fixed, user-facing text. Never contains server or model output. */
  message: string;
  retryable: boolean;
  status?: number;
  retryAfterSeconds?: number;
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; error: PlanError };

export interface PlanProvider {
  id: 'demo' | 'http';
  source: PlanSource;
  label: string;
  /** Resolves with a result; never throws or rejects. */
  generate(request: PlanRequest, signal?: AbortSignal): Promise<PlanResult>;
}
