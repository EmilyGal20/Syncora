// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { describeRecurrence, makeRecurrence, nextOccurrence, sanitizeRecurrence } from './recurrence';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('nextOccurrence', () => {
  it('clamps monthly tasks to short months without drifting afterwards', () => {
    const rule = makeRecurrence('monthly');
    const feb = nextOccurrence('2027-01-31', rule, day(2027, 1, 31))!;
    expect(feb.dueDate).toBe('2027-02-28');
    expect(feb.rule.anchorDay).toBe(31);
    // The anchor carries forward, so March goes back to the 31st.
    const mar = nextOccurrence(feb.dueDate, feb.rule, day(2027, 2, 28))!;
    expect(mar.dueDate).toBe('2027-03-31');
    const apr = nextOccurrence(mar.dueDate, mar.rule, day(2027, 3, 31))!;
    expect(apr.dueDate).toBe('2027-04-30');
  });

  it('handles leap years for monthly and yearly rules', () => {
    expect(nextOccurrence('2028-01-31', makeRecurrence('monthly'), day(2028, 1, 31))!.dueDate).toBe('2028-02-29');
    const y1 = nextOccurrence('2028-02-29', makeRecurrence('yearly'), day(2028, 2, 29))!;
    expect(y1.dueDate).toBe('2029-02-28');
    // Four years later the 29th comes back thanks to the anchor.
    let cur = y1;
    for (let i = 0; i < 3; i++) cur = nextOccurrence(cur.dueDate, cur.rule, new Date(2029 + i, 1, 28))!;
    expect(cur.dueDate).toBe('2032-02-29');
  });

  it('skips weekends for weekday rules', () => {
    expect(nextOccurrence('2026-10-09', makeRecurrence('weekdays'), day(2026, 10, 9))!.dueDate).toBe('2026-10-12');
    expect(nextOccurrence('2026-10-10', makeRecurrence('weekdays'), day(2026, 10, 10))!.dueDate).toBe('2026-10-12');
  });

  it('jumps past today when completing an overdue task', () => {
    expect(nextOccurrence('2026-10-01', makeRecurrence('daily'), day(2026, 10, 8))!.dueDate).toBe('2026-10-09');
    expect(nextOccurrence('2026-09-01', makeRecurrence('weekly', 2), day(2026, 10, 8))!.dueDate).toBe('2026-10-13');
  });

  it('starts from today when there is no due date', () => {
    expect(nextOccurrence(null, makeRecurrence('daily', 3), day(2026, 10, 8))!.dueDate).toBe('2026-10-11');
  });

  it('ends the series after the until date', () => {
    const rule = makeRecurrence('weekly', 1, '2026-10-20');
    expect(nextOccurrence('2026-10-12', rule, day(2026, 10, 12))!.dueDate).toBe('2026-10-19');
    expect(nextOccurrence('2026-10-19', rule, day(2026, 10, 19))).toBeNull();
    // An occurrence exactly on the end date is still allowed.
    expect(nextOccurrence('2026-10-13', rule, day(2026, 10, 13))!.dueDate).toBe('2026-10-20');
  });

  it('crosses daylight-saving changes without shifting the date', () => {
    expect(nextOccurrence('2026-03-28', makeRecurrence('daily'), day(2026, 3, 28))!.dueDate).toBe('2026-03-29');
    expect(nextOccurrence('2026-10-24', makeRecurrence('weekly'), day(2026, 10, 24))!.dueDate).toBe('2026-10-31');
  });
});

describe('sanitizeRecurrence', () => {
  it('upgrades v2 rules that lack the newer fields', () => {
    expect(sanitizeRecurrence({ frequency: 'daily', interval: 1 })).toEqual({ frequency: 'daily', interval: 1, until: null, anchorDay: null });
  });
  it('rejects invalid rules', () => {
    expect(sanitizeRecurrence({ frequency: 'hourly', interval: 1 })).toBeNull();
    expect(sanitizeRecurrence({ frequency: 'daily', interval: 0 })).toBeNull();
    expect(sanitizeRecurrence({ frequency: 'daily', interval: 1.5 })).toBeNull();
    expect(sanitizeRecurrence('daily')).toBeNull();
  });
  it('drops malformed until and anchor values', () => {
    expect(sanitizeRecurrence({ frequency: 'monthly', interval: 1, until: '2026-02-31', anchorDay: 40 })).toEqual({
      frequency: 'monthly',
      interval: 1,
      until: null,
      anchorDay: null,
    });
  });
});

describe('describeRecurrence', () => {
  it('reads naturally', () => {
    expect(describeRecurrence(makeRecurrence('daily'))).toBe('Every day');
    expect(describeRecurrence(makeRecurrence('weekly', 2))).toBe('Every 2 weeks');
    expect(describeRecurrence(makeRecurrence('weekdays', 3))).toBe('Every weekday');
    expect(describeRecurrence(makeRecurrence('monthly', 1, '2026-12-31'))).toMatch(/^Every month until /);
  });
});
