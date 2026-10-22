// @ts-nocheck
export const PLAN_LIMITS = {
  goalMin: 3,
  goalMax: 500,
  maxSuggestions: 10,
  /** Only this many raw provider items are looked at, however many are sent. */
  scanItems: 50,
  titleMax: 200,
  descriptionMax: 1000,
  /** Subtasks accepted from a provider per suggestion. */
  providerSubtasks: 8,
  /** Subtasks a user may have on a suggestion while editing. */
  editSubtasks: 20,
  subtaskMax: 200,
  estimateMin: 15,
  estimateMax: 480,
  estimateStep: 15,
  estimateDefault: 60,
  maxDeadlineDays: 365,
  defaultDeadlineDays: 7,
  requestBytes: 4 * 1024,
  responseBytes: 64 * 1024,
  goalInDescription: 200,
  projectNameMax: 60,
  timeoutMs: 20_000,
  demoDelayMs: 600,
} as const;

/** Estimate choices offered in the editor, in minutes. */
export const ESTIMATE_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480] as const;
