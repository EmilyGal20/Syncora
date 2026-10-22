// @ts-nocheck
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isDeadlineInRange, parseDeadlinePhrase, resolveDeadline } from './deadline';
import { extractTopic } from './classify';

// Date edge cases for the deadline parser. Every case passes an explicit `today`.
const at = (today: string) => (text: string) => parseDeadlinePhrase(text, today);

describe('parseDeadlinePhrase: month and year boundaries', () => {
  // 2026-12-30 is a Wednesday.
  const parse = at('2026-12-30');

  it.each([
    ['Finish in 5 days', '2027-01-04'],
    ['Finish in 2 weeks', '2027-01-13'],
    ['Finish tomorrow', '2026-12-31'],
    ['Report by Jan 2', '2027-01-02'],
    ['Report by 2 January', '2027-01-02'],
    ['Report by Dec 30', '2026-12-30'],
    ['Report by Dec 29', '2027-12-29'],
    ['Pay by end of month', '2026-12-31'],
    ['Wrap up by the end of the week', '2027-01-03'],
    ['Start next week', '2027-01-04'],
    ['Ship by Friday', '2027-01-01'],
  ])('%s → %s', (text, expected) => {
    expect(parse(text)).toBe(expected);
  });

  it('treats "end of month" on the last day of the month as today', () => {
    expect(parseDeadlinePhrase('by end of month', '2026-12-31')).toBe('2026-12-31');
    expect(parseDeadlinePhrase('by end of month', '2026-04-30')).toBe('2026-04-30');
  });

  it('resolves a month/day that has passed this year to next year, within range', () => {
    expect(resolveDeadline({ goal: 'Report by Dec 29', deadline: null, today: '2026-12-30' })).toEqual({ date: '2027-12-29', source: 'parsed' });
  });
});

describe('parseDeadlinePhrase: leap years', () => {
  // 2028-02-28 is a Monday in a leap year.
  const parse = at('2028-02-28');

  it.each([
    ['Finish tomorrow', '2028-02-29'],
    ['Finish in 1 day', '2028-02-29'],
    ['Finish in 2 days', '2028-03-01'],
    ['Pay by end of month', '2028-02-29'],
    ['Due Feb 29', '2028-02-29'],
    ['Due 29th of February', '2028-02-29'],
  ])('%s → %s', (text, expected) => {
    expect(parse(text)).toBe(expected);
  });

  it('handles Feb 29 asked from a non-leap year', () => {
    // From 2027-02-28 the next Feb 29 is 366 days away: parsed, but outside the deadline window.
    expect(parseDeadlinePhrase('Due Feb 29', '2027-02-28')).toBe('2028-02-29');
    expect(resolveDeadline({ goal: 'Due Feb 29', deadline: null, today: '2027-02-28' }).source).toBe('default');
    // From 2027-03-01 it is exactly 365 days away: still allowed.
    expect(resolveDeadline({ goal: 'Due Feb 29', deadline: null, today: '2027-03-01' })).toEqual({ date: '2028-02-29', source: 'parsed' });
    expect(parseDeadlinePhrase('tomorrow', '2027-02-28')).toBe('2027-03-01');
    expect(parseDeadlinePhrase('by end of month', '2027-02-10')).toBe('2027-02-28');
  });

  it('returns null for Feb 29 when neither this year nor next is a leap year', () => {
    expect(parseDeadlinePhrase('Due Feb 29', '2026-03-01')).toBeNull();
  });

  it('accepts an explicit deadline 365 days ahead across a leap day', () => {
    expect(isDeadlineInRange('2029-02-27', '2028-02-28')).toBe(true);
    expect(isDeadlineInRange('2029-02-28', '2028-02-28')).toBe(false);
  });
});

describe('parseDeadlinePhrase: weekday names on that same weekday', () => {
  // 2026-10-16 is a Friday.
  const FRIDAY = '2026-10-16';
  const parse = at(FRIDAY);

  it('never resolves a weekday name to today', () => {
    for (const text of ['by Friday', 'Friday', 'due fri', 'this Friday', 'next Friday']) {
      expect(parse(text)).not.toBe(FRIDAY);
    }
  });

  it('on a Friday, "by Friday" and "next Friday" both mean a week from today', () => {
    expect(parse('by Friday')).toBe('2026-10-23');
    expect(parse('next Friday')).toBe('2026-10-23');
  });

  it('on other days "next Friday" is the Friday after the coming one', () => {
    expect(at('2026-10-14')('next Friday')).toBe('2026-10-23');
    expect(at('2026-10-14')('by Friday')).toBe('2026-10-16');
  });

  it('other weekdays from a Friday', () => {
    expect(parse('by Saturday')).toBe('2026-10-17');
    expect(parse('by Thursday')).toBe('2026-10-22');
    expect(parse('next week')).toBe('2026-10-19');
    expect(parse('end of week')).toBe('2026-10-18');
  });
});

describe('parseDeadlinePhrase: DST change weeks', () => {
  // No @types/node in this project, so reach process.env through globalThis.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
  const original = env.TZ;
  beforeAll(() => {
    env.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (original === undefined) delete env.TZ;
    else env.TZ = original;
  });

  it('runs in a zone that really changes offset (sanity check)', () => {
    expect(new Date(2026, 10, 2, 12).getTimezoneOffset()).not.toBe(new Date(2026, 9, 30, 12).getTimezoneOffset());
  });

  it('counts calendar days across the November fall-back (2026-11-01)', () => {
    const parse = at('2026-10-30'); // Friday
    expect(parse('in 3 days')).toBe('2026-11-02');
    expect(parse('by Sunday')).toBe('2026-11-01');
    expect(parse('next week')).toBe('2026-11-02');
    expect(parse('end of week')).toBe('2026-11-01');
    expect(parse('in 1 week')).toBe('2026-11-06');
    expect(resolveDeadline({ goal: 'Clean up', deadline: null, today: '2026-10-29' })).toEqual({ date: '2026-11-05', source: 'default' });
  });

  it('counts calendar days across the March spring-forward (2027-03-14)', () => {
    const parse = at('2027-03-13'); // Saturday
    expect(parse('tomorrow')).toBe('2027-03-14');
    expect(parse('in 2 days')).toBe('2027-03-15');
    expect(parse('end of week')).toBe('2027-03-14');
    expect(parse('in 1 week')).toBe('2027-03-20');
  });

  it('keeps the 365-day window exact across a DST change', () => {
    expect(isDeadlineInRange('2027-03-07', '2026-03-07')).toBe(true);
    expect(isDeadlineInRange('2027-03-08', '2026-03-07')).toBe(false);
    expect(isDeadlineInRange('2026-11-01', '2026-11-01')).toBe(true);
  });
});

describe('parseDeadlinePhrase: phrases inside a sentence', () => {
  // 2026-10-11 is a Sunday.
  const parse = at('2026-10-11');

  it.each([
    ['Okay so the plan is to, by Thursday, have the slides done', '2026-10-15'],
    ['I need the deck (due Oct 20th) polished and sent', '2026-10-20'],
    ['Ship v2 — tomorrow — no excuses', '2026-10-12'],
    ['Get the garden sorted in 3 weeks if the weather holds', '2026-11-01'],
    ['Taxes: due 2026-12-01, papers are in the drawer', '2026-12-01'],
  ])('%s → %s', (text, expected) => {
    expect(parse(text)).toBe(expected);
  });

  it('does not match weekday or month names inside other words', () => {
    expect(parse('Organize the monthly budget')).toBeNull();
    expect(parse('Plan the wedding speech')).toBeNull();
    expect(parse('Update the Monday.com board')).not.toBeNull(); // "Monday" is a whole word here
    expect(parse('Write about the sunset')).toBeNull();
    expect(parse('Fix the frisbee')).toBeNull();
  });

  // Short weekday abbreviations are also ordinary English words, so they only count after a
  // preposition or "this"/"next".
  it('does not read the words "sun", "sat" or "wed" as weekdays', () => {
    expect(parse('Build a sun room')).toBeNull();
    expect(parse('Re-sit the exam I sat last year')).toBeNull();
    expect(parse('Get wed in the spring')).toBeNull();
  });

  it('still reads abbreviations after a preposition or this/next', () => {
    expect(parse('Finish the deck by fri')).toBe('2026-10-16');
    expect(parse('Report due wed.')).toBe('2026-10-14');
    expect(parse('Launch next sat')).toBe('2026-10-24');
  });

  it('keeps ordinary words in the topic', () => {
    expect(extractTopic('Build a sun room')).toBe('sun room');
  });
});

describe('parseDeadlinePhrase: goals with two phrases', () => {
  const parse = at('2026-10-11');

  it('takes the first occurrence when both phrases are of the same kind', () => {
    expect(parse('by Friday, not Monday')).toBe('2026-10-16');
    expect(parse('Jan 5 or Feb 10')).toBe('2027-01-05');
    expect(parse('in 3 days, at most in 10 days')).toBe('2026-10-14');
  });

  it('otherwise the rule order decides, not the position in the text', () => {
    // ISO > today/tonight > tomorrow > in N days > next week > weekday > month day > end of week/month.
    expect(parse('by Oct 20, or tomorrow at the latest')).toBe('2026-10-12');
    expect(parse('by Friday or in 3 days')).toBe('2026-10-14');
    expect(parse('end of month, or 2026-10-25')).toBe('2026-10-25');
  });

  it('skips an invalid first phrase and falls through to the next rule', () => {
    expect(parse('by 2026-02-30 or tomorrow')).toBe('2026-10-12');
    expect(parse('in 400 days or by Friday')).toBe('2026-10-16');
  });
});

describe('resolveDeadline: precedence edge cases', () => {
  it('ignores an explicit deadline outside the window and falls back to the phrase, then the default', () => {
    expect(resolveDeadline({ goal: 'by Friday', deadline: '2026-10-01', today: '2026-10-11' })).toEqual({ date: '2026-10-16', source: 'parsed' });
    expect(resolveDeadline({ goal: 'no phrase', deadline: '2030-01-01', today: '2026-10-11' })).toEqual({ date: '2026-10-18', source: 'default' });
  });

  it('accepts an explicit deadline of today', () => {
    expect(resolveDeadline({ goal: 'by Friday', deadline: '2026-10-11', today: '2026-10-11' })).toEqual({ date: '2026-10-11', source: 'explicit' });
  });

  it('defaults across a year boundary', () => {
    expect(resolveDeadline({ goal: 'tidy up', deadline: null, today: '2026-12-28' })).toEqual({ date: '2027-01-04', source: 'default' });
  });
});
