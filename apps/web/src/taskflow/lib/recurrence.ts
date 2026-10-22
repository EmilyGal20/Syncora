// @ts-nocheck
import type { Recurrence, RecurrenceFrequency } from '../types';
import { addDays, formatShortDate, isValidISODate, parseISODate, startOfDay, toISODate } from './date';

export const RECURRENCE_OPTIONS: { value: RecurrenceFrequency; label: string; unit: string }[] = [
  { value: 'daily', label: 'Daily', unit: 'day' },
  { value: 'weekdays', label: 'Every weekday', unit: 'weekday' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'monthly', label: 'Monthly', unit: 'month' },
  { value: 'yearly', label: 'Yearly', unit: 'year' },
];

export const MAX_INTERVAL = 99;

export function makeRecurrence(frequency: RecurrenceFrequency, interval = 1, until: string | null = null): Recurrence {
  return { frequency, interval, until, anchorDay: null };
}

/** Validates untrusted input and fills fields added in later versions. */
export function sanitizeRecurrence(value: unknown): Recurrence | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Record<string, unknown>;
  const option = RECURRENCE_OPTIONS.find((o) => o.value === r.frequency);
  const interval = Number(r.interval);
  if (!option || !Number.isInteger(interval) || interval < 1 || interval > MAX_INTERVAL) return null;
  const anchor = Number(r.anchorDay);
  return {
    frequency: option.value,
    interval,
    until: isValidISODate(r.until) ? r.until : null,
    anchorDay: Number.isInteger(anchor) && anchor >= 1 && anchor <= 31 ? anchor : null,
  };
}

export function describeRecurrence(rule: Recurrence): string {
  let text: string;
  if (rule.frequency === 'weekdays') text = 'Every weekday';
  else {
    const unit = RECURRENCE_OPTIONS.find((o) => o.value === rule.frequency)!.unit;
    text = rule.interval === 1 ? (rule.frequency === 'daily' ? 'Every day' : `Every ${unit}`) : `Every ${rule.interval} ${unit}s`;
  }
  return rule.until ? `${text} until ${formatShortDate(parseISODate(rule.until))}` : text;
}

/** Month arithmetic that clamps to the month's length but remembers the intended day. */
function addMonthsAnchored(d: Date, months: number, anchorDay: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay, lastDay));
  return target;
}

function step(d: Date, rule: Recurrence, anchorDay: number): Date {
  switch (rule.frequency) {
    case 'daily':
      return addDays(d, rule.interval);
    case 'weekdays': {
      let next = addDays(d, 1);
      while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1);
      return next;
    }
    case 'weekly':
      return addDays(d, 7 * rule.interval);
    case 'monthly':
      return addMonthsAnchored(d, rule.interval, anchorDay);
    case 'yearly':
      return addMonthsAnchored(d, 12 * rule.interval, anchorDay);
  }
}

export interface NextOccurrence {
  dueDate: string;
  /** The rule to store on the new occurrence (anchor day filled in). */
  rule: Recurrence;
}

/**
 * The next occurrence after completing a recurring task, or null when the series has ended.
 * Steps forward from the current due date (or today) until the date is after `today`, so
 * completing a task that is weeks overdue doesn't create a backlog of already-overdue copies.
 */
export function nextOccurrence(dueDate: string | null, rule: Recurrence, today = new Date()): NextOccurrence | null {
  const floor = startOfDay(today);
  let d = dueDate ? parseISODate(dueDate) : floor;
  const anchorDay = rule.anchorDay ?? d.getDate();
  for (let i = 0; i < 2000; i++) {
    d = step(d, rule, anchorDay);
    if (d > floor) break;
  }
  if (rule.until && d > parseISODate(rule.until)) return null;
  const keepsAnchor = rule.frequency === 'monthly' || rule.frequency === 'yearly';
  return { dueDate: toISODate(d), rule: { ...rule, anchorDay: keepsAnchor ? anchorDay : null } };
}
