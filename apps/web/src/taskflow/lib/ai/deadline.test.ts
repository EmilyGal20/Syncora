// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { parseDeadlinePhrase, resolveDeadline } from './deadline';

// A Sunday.
const TODAY = '2026-10-11';
const parse = (text: string) => parseDeadlinePhrase(text, TODAY);

describe('parseDeadlinePhrase', () => {
  it.each([
    ['Finish the report tomorrow', '2026-10-12'],
    ['Finish my project by Thursday', '2026-10-15'],
    ['Finish my project next Thursday', '2026-10-22'],
    ['Ship it by this Friday', '2026-10-16'],
    ['due thu', '2026-10-15'],
    ['by Sunday', '2026-10-18'],
    ['Write the essay in 5 days', '2026-10-16'],
    ['Learn Spanish basics in 2 weeks', '2026-10-25'],
    ['Plan the party next week', '2026-10-12'],
    ['Submit the paper by Oct 20', '2026-10-20'],
    ['Submit the paper by October 20th', '2026-10-20'],
    ['Taxes by 20 October', '2026-10-20'],
    ['Trip planning Jan 5', '2027-01-05'],
    ['Pay rent by end of month', '2026-10-31'],
    ['Clean the garage by the end of the week', '2026-10-11'],
    ['Finish tonight', '2026-10-11'],
    ['Deadline 2026-11-03 for the launch', '2026-11-03'],
  ])('%s → %s', (text, expected) => {
    expect(parse(text)).toBe(expected);
  });

  it('is case-insensitive', () => {
    expect(parse('BY THURSDAY')).toBe('2026-10-15');
  });

  it('rejects an invalid ISO date', () => {
    expect(parse('finish by 2026-02-30')).toBeNull();
    expect(parse('finish by 2026-13-01')).toBeNull();
  });

  it('returns null when there is no phrase', () => {
    expect(parse('Learn to cook pasta')).toBeNull();
    expect(parse('')).toBeNull();
  });

  it('ignores out-of-range "in N days"', () => {
    expect(parse('in 0 days')).toBeNull();
    expect(parse('in 400 days')).toBeNull();
  });

  it('prefers the earlier rule when several phrases match', () => {
    // ISO beats a weekday; "tomorrow" beats "next week".
    expect(parse('by Friday or 2026-10-20')).toBe('2026-10-20');
    expect(parse('next week, ideally tomorrow')).toBe('2026-10-12');
  });

  it('works for a weekday that is not today', () => {
    // From a Wednesday, "Friday" is two days later and "Wednesday" is a week later.
    expect(parseDeadlinePhrase('by Friday', '2026-10-14')).toBe('2026-10-16');
    expect(parseDeadlinePhrase('by Wednesday', '2026-10-14')).toBe('2026-10-21');
    expect(parseDeadlinePhrase('next week', '2026-10-14')).toBe('2026-10-19');
  });
});

describe('resolveDeadline', () => {
  it('uses the explicit deadline over a phrase', () => {
    expect(resolveDeadline({ goal: 'finish by Thursday', deadline: '2026-10-20', today: TODAY })).toEqual({
      date: '2026-10-20',
      source: 'explicit',
    });
  });

  it('uses a parsed phrase when no deadline is given', () => {
    expect(resolveDeadline({ goal: 'finish by Thursday', deadline: null, today: TODAY })).toEqual({ date: '2026-10-15', source: 'parsed' });
  });

  it('defaults to one week', () => {
    expect(resolveDeadline({ goal: 'learn to cook', deadline: null, today: TODAY })).toEqual({ date: '2026-10-18', source: 'default' });
  });

  it('ignores a parsed date in the past', () => {
    expect(resolveDeadline({ goal: 'done by 2026-10-01', deadline: null, today: TODAY }).source).toBe('default');
  });
});
