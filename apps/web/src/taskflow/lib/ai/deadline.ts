// @ts-nocheck
import { addDays, diffInDays, isValidISODate, parseISODate, toISODate } from '../date';
import { PLAN_LIMITS } from './limits';
import type { DeadlineSource, PlanRequest } from './types';

const FULL_WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
// Abbreviations double as ordinary words ("sun room", "I sat", "get wed"), so they only count
// as weekdays after a preposition or "this"/"next" ("by sat", "due wed", "next fri").
const SHORT_WEEKDAYS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const PREP = String.raw`(?:(?:by|on|before|until|due)\s+)?`;
const FULL_WEEKDAY_RE = Object.keys(FULL_WEEKDAYS).join('|');
const SHORT_WEEKDAY_RE = Object.keys(SHORT_WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

interface Matcher {
  re: RegExp;
  /** Returns the date for a match, or null to keep looking with the next matcher. */
  resolve: (m: RegExpExecArray, today: Date) => Date | null;
}

const fromParts = (y: number, month: number, day: number): Date | null => {
  const d = new Date(y, month, day);
  return d.getMonth() === month && d.getDate() === day ? d : null;
};

/** Month/day without a year: this year, or next year when it has already passed. */
const upcomingMonthDay = (month: number, day: number, today: Date): Date | null => {
  const thisYear = fromParts(today.getFullYear(), month, day);
  if (thisYear && diffInDays(thisYear, today) >= 0) return thisYear;
  return fromParts(today.getFullYear() + 1, month, day);
};

/**
 * The next occurrence of a weekday strictly after today. "next <day>" means the one after that,
 * except when today is that weekday, where the plain next occurrence is already a week away.
 */
function nextWeekday(target: number, qualifier: string | undefined, today: Date): Date {
  const ahead = (target - today.getDay() + 7) % 7 || 7;
  const extra = qualifier?.toLowerCase() === 'next' && ahead !== 7 ? 7 : 0;
  return addDays(today, ahead + extra);
}

// Order matters: the first matcher that resolves wins.
const MATCHERS: Matcher[] = [
  {
    re: new RegExp(String.raw`${PREP}\b(\d{4}-\d{2}-\d{2})\b`, 'i'),
    resolve: (m) => (isValidISODate(m[1]) ? parseISODate(m[1]) : null),
  },
  { re: new RegExp(String.raw`${PREP}\b(?:today|tonight)\b`, 'i'), resolve: (_m, today) => today },
  { re: new RegExp(String.raw`${PREP}\btomorrow\b`, 'i'), resolve: (_m, today) => addDays(today, 1) },
  {
    re: /\bin\s+(\d{1,3})\s+(days?|weeks?)\b/i,
    resolve: (m, today) => {
      const days = Number(m[1]) * (m[2].toLowerCase().startsWith('week') ? 7 : 1);
      return days >= 1 && days <= PLAN_LIMITS.maxDeadlineDays ? addDays(today, days) : null;
    },
  },
  {
    re: new RegExp(String.raw`${PREP}\bnext\s+week\b`, 'i'),
    resolve: (_m, today) => addDays(today, 7 - ((today.getDay() + 6) % 7)),
  },
  {
    re: new RegExp(String.raw`${PREP}\b(?:(this|next)\s+)?(${FULL_WEEKDAY_RE})\b`, 'i'),
    resolve: (m, today) => nextWeekday(FULL_WEEKDAYS[m[2].toLowerCase()], m[1], today),
  },
  {
    re: new RegExp(String.raw`\b(?:(?:by|on|before|until|due)\s+(?:(this|next)\s+)?|(this|next)\s+)(${SHORT_WEEKDAY_RE})\b\.?`, 'i'),
    resolve: (m, today) => nextWeekday(SHORT_WEEKDAYS[m[3].toLowerCase()], m[1] ?? m[2], today),
  },
  {
    re: new RegExp(String.raw`${PREP}\b(${MONTH_RE})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b`, 'i'),
    resolve: (m, today) => upcomingMonthDay(MONTHS[m[1].toLowerCase()], Number(m[2]), today),
  },
  {
    re: new RegExp(String.raw`${PREP}\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_RE})\b`, 'i'),
    resolve: (m, today) => upcomingMonthDay(MONTHS[m[2].toLowerCase()], Number(m[1]), today),
  },
  {
    re: new RegExp(String.raw`${PREP}\b(?:the\s+)?end\s+of\s+(?:the\s+)?week\b`, 'i'),
    resolve: (_m, today) => addDays(today, (7 - today.getDay()) % 7),
  },
  {
    re: new RegExp(String.raw`${PREP}\b(?:the\s+)?end\s+of\s+(?:the\s+)?month\b`, 'i'),
    resolve: (_m, today) => new Date(today.getFullYear(), today.getMonth() + 1, 0),
  },
];

/**
 * Finds an English deadline phrase in free text ("by Thursday", "in 2 weeks", "Oct 20").
 * `today` is the user's local date (YYYY-MM-DD). Returns a YYYY-MM-DD date or null.
 */
export function parseDeadlinePhrase(text: string, today: string): string | null {
  if (!isValidISODate(today)) return null;
  const base = parseISODate(today);
  for (const { re, resolve } of MATCHERS) {
    const m = re.exec(text);
    if (!m) continue;
    const date = resolve(m, base);
    if (date) return toISODate(date);
  }
  return null;
}

/** Removes every recognisable deadline phrase, valid or not (used to extract the topic). */
export function stripDeadlinePhrases(text: string): string {
  return MATCHERS.reduce((acc, { re }) => acc.replace(new RegExp(re.source, 'gi'), ' '), text);
}

/** Whether a date lies in the allowed deadline window [today, today + 365]. */
export function isDeadlineInRange(date: string, today: string): boolean {
  if (!isValidISODate(date) || !isValidISODate(today)) return false;
  const diff = diffInDays(parseISODate(date), parseISODate(today));
  return diff >= 0 && diff <= PLAN_LIMITS.maxDeadlineDays;
}

/** Effective deadline = explicit deadline ?? phrase parsed from the goal ?? today + 7. */
export function resolveDeadline(request: Pick<PlanRequest, 'goal' | 'deadline' | 'today'>): {
  date: string;
  source: DeadlineSource;
} {
  if (request.deadline && isDeadlineInRange(request.deadline, request.today)) {
    return { date: request.deadline, source: 'explicit' };
  }
  const parsed = parseDeadlinePhrase(request.goal, request.today);
  if (parsed && isDeadlineInRange(parsed, request.today)) return { date: parsed, source: 'parsed' };
  return { date: toISODate(addDays(parseISODate(request.today), PLAN_LIMITS.defaultDeadlineDays)), source: 'default' };
}
