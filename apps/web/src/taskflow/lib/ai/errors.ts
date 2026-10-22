// @ts-nocheck
import type { PlanError, PlanErrorKind } from './types';

// Fixed copy only: server and model text is never shown to the user.
const MESSAGES: Record<PlanErrorKind, string> = {
  invalid_request: 'Check your goal and deadline, then try again.',
  not_configured: 'The AI planner isn’t set up yet.',
  network: 'Couldn’t reach the planner. Check your connection and try again.',
  timeout: 'The planner took too long to respond. Try again.',
  aborted: '',
  rate_limited: 'Too many plan requests right now. Wait a moment and try again.',
  http: 'The planner couldn’t create a plan right now. Try again later.',
  too_large: 'The planner sent back more than we can use. Try a shorter goal.',
  malformed: 'The planner sent back something we couldn’t read. Try again.',
  empty: 'No usable tasks were suggested. Try describing your goal differently.',
};

const RETRYABLE: Record<PlanErrorKind, boolean> = {
  invalid_request: false,
  not_configured: false,
  network: true,
  timeout: true,
  aborted: false,
  rate_limited: true,
  http: false,
  too_large: false,
  malformed: true,
  empty: false,
};

export function planError(kind: PlanErrorKind, extra: Partial<Omit<PlanError, 'kind' | 'message'>> = {}): PlanError {
  return { kind, message: MESSAGES[kind], retryable: RETRYABLE[kind], ...extra };
}
