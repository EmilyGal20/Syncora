// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { addDays, parseISODate, toISODate } from '../date';
import { validatePlan, type ValidateContext } from './validate';
import type { Plan, PlanResult } from './types';

// Edge cases for validatePlan beyond validate.test.ts. Explicit dates only, no clock.
const TODAY = '2026-10-11';
const plusDays = (n: number) => toISODate(addDays(parseISODate(TODAY), n));

const ctxWith = (effectiveDeadline: string): ValidateContext => ({
  id: 'plan_x',
  source: 'ai',
  providerLabel: 'AI planner',
  goal: 'Goal',
  today: TODAY,
  effectiveDeadline,
  deadlineSource: 'explicit',
});
const CTX = ctxWith('2026-10-21');

const item = (title: unknown, extra: Record<string, unknown> = {}) => ({
  title,
  description: '',
  priority: 'medium',
  estimateMinutes: 60,
  dueDate: '2026-10-15',
  subtasks: [],
  ...extra,
});

function ok(result: PlanResult): Plan {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.kind}`);
  return result.plan;
}
const run = (suggestions: unknown[], ctx = CTX) => ok(validatePlan({ suggestions }, ctx));
const one = (raw: Record<string, unknown>, ctx = CTX) => run([raw], ctx).suggestions[0];
const codesAt = (plan: Plan, index: number) => plan.warnings.filter((w) => w.index === index).map((w) => w.code);

const SUGGESTION_KEYS = ['dateAdjusted', 'description', 'dueDate', 'estimateMinutes', 'key', 'priority', 'subtasks', 'title'];

describe('validatePlan: mixed valid and invalid items', () => {
  it('keeps the valid items, repairs the fixable ones and reports each problem by raw index', () => {
    const plan = run([
      item('Alpha'), // 0 ok
      null, // 1 dropped
      item(42), // 2 dropped: non-string title
      item('   '), // 3 dropped: blank
      item('Bravo', { priority: 7, estimateMinutes: '90' }), // 4 priority repaired, estimate fine
      item('Charlie', { dueDate: 20261015 }), // 5 unusable date
      item('alpha!'), // 6 duplicate of 0
      ['Delta'], // 7 dropped: array
      item('Echo', { estimateMinutes: -5 }), // 8 estimate repaired
    ]);
    expect(plan.suggestions.map((s) => s.title).sort()).toEqual(['Alpha', 'Bravo', 'Charlie', 'Echo']);
    expect(plan.warnings.filter((w) => w.code === 'item_dropped').map((w) => w.index)).toEqual([1, 2, 3, 7]);
    expect(plan.warnings.filter((w) => w.code === 'duplicate_removed').map((w) => w.index)).toEqual([6]);
    expect(codesAt(plan, 4)).toEqual(['field_repaired']);
    expect(codesAt(plan, 5)).toEqual(['date_adjusted']);
    expect(codesAt(plan, 8)).toEqual(['field_repaired']);
    expect(codesAt(plan, 0)).toEqual([]);
    const bravo = plan.suggestions.find((s) => s.title === 'Bravo')!;
    expect(bravo).toMatchObject({ priority: 'medium', estimateMinutes: 90 });
    expect(plan.suggestions.find((s) => s.title === 'Charlie')).toMatchObject({ dateAdjusted: true, dueDate: '2026-10-21' });
    expect(plan.suggestions.map((s) => s.key)).toEqual(['s0', 's1', 's2', 's3']);
  });
});

describe('validatePlan: estimates', () => {
  it.each([
    ['90', 90, false],
    [' 45 ', 45, false],
    ['120.0', 120, false],
    ['1e2', 105, false],
    ['15', 15, false],
    ['480', 480, false],
    ['0', 15, true],
    ['-30', 15, true],
    ['481', 480, true],
    ['', 60, true],
    ['2h', 60, true],
    ['Infinity', 60, true],
    [true, 60, true],
    [null, 60, true],
    [{}, 60, true],
    [[90], 60, true],
  ])('estimateMinutes %j → %i (repaired: %s)', (raw, minutes, repaired) => {
    const plan = run([item('A', { estimateMinutes: raw })]);
    expect(plan.suggestions[0].estimateMinutes).toBe(minutes);
    expect(codesAt(plan, 0).includes('field_repaired')).toBe(repaired);
  });

  it('always yields a multiple of 15 within 15–480', () => {
    for (let n = -100; n <= 600; n += 7) {
      const m = one(item('A', { estimateMinutes: n })).estimateMinutes;
      expect(m % 15).toBe(0);
      expect(m).toBeGreaterThanOrEqual(15);
      expect(m).toBeLessThanOrEqual(480);
    }
  });
});

describe('validatePlan: subtasks', () => {
  it('ignores subtasks given as objects, arrays, numbers or null and keeps the strings', () => {
    const s = one(item('A', { subtasks: [{ title: 'Object subtask' }, 'Real one', ['nested'], null, 5, { text: 'x' }, 'Second'] }));
    expect(s.subtasks).toEqual(['Real one', 'Second']);
  });

  it('treats a subtasks object (not an array) as no subtasks', () => {
    expect(one(item('A', { subtasks: { 0: 'one', length: 1 } })).subtasks).toEqual([]);
    expect(one(item('A', { subtasks: null })).subtasks).toEqual([]);
  });
});

describe('validatePlan: deadline equal to today', () => {
  it('puts every item on today, flags moved dates, and does not flag missing ones', () => {
    const plan = run(
      [
        item('Past', { dueDate: '2026-10-01' }),
        item('Today', { dueDate: TODAY }),
        item('Future', { dueDate: '2026-10-12' }),
        item('Missing', { dueDate: undefined }),
        item('Garbage', { dueDate: 'tomorrow' }),
      ],
      ctxWith(TODAY),
    );
    expect(plan.suggestions.every((s) => s.dueDate === TODAY)).toBe(true);
    const flags = Object.fromEntries(plan.suggestions.map((s) => [s.title, s.dateAdjusted]));
    expect(flags).toEqual({ Past: true, Today: false, Future: true, Missing: false, Garbage: true });
  });
});

describe('validatePlan: deadline 365 days ahead', () => {
  const deadline = plusDays(365);

  it('keeps a date on the deadline and clamps one a day later', () => {
    expect(deadline).toBe('2027-10-11');
    expect(one(item('A', { dueDate: deadline }), ctxWith(deadline))).toMatchObject({ dueDate: deadline, dateAdjusted: false });
    expect(one(item('A', { dueDate: '2027-10-12' }), ctxWith(deadline))).toMatchObject({ dueDate: deadline, dateAdjusted: true });
  });

  it('spreads undated items evenly across the whole year, ending on the deadline', () => {
    const plan = run([item('A', { dueDate: undefined }), item('B', { dueDate: undefined }), item('C', { dueDate: undefined })], ctxWith(deadline));
    expect(plan.suggestions.map((s) => s.dueDate)).toEqual([plusDays(122), plusDays(243), deadline]);
  });
});

describe('validatePlan: all suggestions on one date', () => {
  it('orders by priority (highest first) and then by original order', () => {
    const plan = run([
      item('Low', { priority: 'low' }),
      item('Urgent 1', { priority: 'urgent' }),
      item('Medium', { priority: 'medium' }),
      item('Urgent 2', { priority: 'urgent' }),
      item('High', { priority: 'high' }),
    ]);
    expect(plan.suggestions.map((s) => s.title)).toEqual(['Urgent 1', 'Urgent 2', 'High', 'Medium', 'Low']);
    expect(new Set(plan.suggestions.map((s) => s.dueDate))).toEqual(new Set(['2026-10-15']));
    expect(plan.suggestions.every((s) => !s.dateAdjusted)).toBe(true);
    expect(plan.warnings).toEqual([]);
  });
});

describe('validatePlan: prototype-pollution-like input', () => {
  it('never pollutes Object.prototype and copies only known fields', () => {
    const raw = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},' +
        '"suggestions":[' +
        '{"title":"Real","__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}},"extra":"<b>",' +
        '"subtasks":["__proto__","constructor","toString"]},' +
        '{"__proto__":{"title":"Inherited title"}},' +
        '{"title":"__proto__"},' +
        '{"title":"hasOwnProperty","priority":"__proto__","estimateMinutes":"__proto__","dueDate":"__proto__"}' +
        ']}',
    );
    const plan = ok(validatePlan(raw, CTX));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();

    // The item whose title only exists through a "__proto__" key is dropped.
    expect(plan.suggestions.map((s) => s.title)).toEqual(['Real', '__proto__', 'hasOwnProperty']);
    for (const s of plan.suggestions) {
      expect(Object.keys(s).sort()).toEqual(SUGGESTION_KEYS);
      expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    }
    expect(plan.suggestions[0].subtasks).toEqual(['__proto__', 'constructor', 'toString']);
    expect(plan.suggestions[2]).toMatchObject({ priority: 'medium', estimateMinutes: 60, dateAdjusted: true });
    expect(Object.keys(plan).sort()).toEqual(['deadlineSource', 'effectiveDeadline', 'goal', 'id', 'providerLabel', 'source', 'suggestions', 'warnings']);
  });
});

describe('validatePlan: extremely long input', () => {
  it('caps titles, descriptions and subtasks without hanging', () => {
    const s = one(
      item('x'.repeat(1_000_000), {
        description: 'd'.repeat(1_000_000),
        subtasks: ['s'.repeat(100_000), ...Array.from({ length: 5000 }, (_, i) => `Sub ${i}`)],
      }),
    );
    expect(s.title).toHaveLength(200);
    expect(s.description).toHaveLength(1000);
    expect(s.subtasks).toHaveLength(8);
    expect(s.subtasks[0]).toHaveLength(200);
  });

  it('collapses huge whitespace runs in titles', () => {
    expect(one(item(`  a${' \t\n'.repeat(100_000)}b  `)).title).toBe('a b');
  });

  it('looks at no more than 50 raw items out of thousands and keeps 10', () => {
    const plan = run(Array.from({ length: 10_000 }, (_, i) => item(`Task ${i}`)));
    expect(plan.suggestions).toHaveLength(10);
    expect(plan.warnings.filter((w) => w.code === 'too_many')).toHaveLength(1);
  });
});

describe('validatePlan: non-string fields', () => {
  it('replaces wrongly typed optional fields with safe defaults', () => {
    const s = one(
      item('A', { description: { html: '<b>' }, priority: ['high'], estimateMinutes: false, dueDate: new Date(2026, 9, 15), subtasks: 'one, two' }),
    );
    expect(s).toMatchObject({ title: 'A', description: '', priority: 'medium', estimateMinutes: 60, subtasks: [], dateAdjusted: true });
    expect(s.dueDate >= TODAY && s.dueDate <= '2026-10-21').toBe(true);
  });

  it('drops items whose title is not a string', () => {
    for (const title of [123, true, null, undefined, { text: 'A' }, ['A']]) {
      const result = validatePlan({ suggestions: [item(title)] }, CTX);
      expect(result.ok === false && result.error.kind).toBe('empty');
    }
  });
});

describe('validatePlan: unicode, RTL and emoji', () => {
  it.each([
    ['Hebrew', 'לסיים את הפרויקט עד חמישי'],
    ['Arabic', 'إنهاء التقرير'],
    ['CJK', '完成季度报告'],
    ['Emoji inside text', 'Launch 🚀 the site 🎉'],
    ['ZWJ emoji', 'Plan trip 👨‍👩‍👧 with family'],
    ['Combining marks', 'Café menu'],
    ['Mixed LTR/RTL', 'Review שלב 2 report'],
  ])('keeps a %s title intact', (_label, title) => {
    expect(one(item(title, { subtasks: [title] }))).toMatchObject({ title, subtasks: [title] });
  });

  it('strips bidi override and isolate characters that could disguise text', () => {
    expect(one(item('Pay invoice‮txt.exe')).title).toBe('Pay invoice txt.exe');
    expect(one(item('⁦Hidden⁩ title‏')).title).toBe('Hidden title');
  });

  it('dedupes non-Latin titles case-insensitively', () => {
    const plan = run([item('ÉTÉ PLAN'), item('été plan'), item('שלום'), item('שלום!')]);
    expect(plan.suggestions.map((s) => s.title)).toEqual(['ÉTÉ PLAN', 'שלום']);
  });

  // Known bug (see QA report): titleKey only keeps letters and digits, so an emoji-only title
  // gets an empty key and is dropped as unusable even though it is a non-empty 1–200 char title.
  it('keeps an emoji-only title', () => {
    expect(one(item('🎉🎂')).title).toBe('🎉🎂');
  });

  // Known bug (see QA report): truncation uses String#slice on UTF-16 code units, so an emoji at
  // the 200-character boundary is cut in half and leaves a lone surrogate in the title.
  it('never leaves a lone surrogate when truncating', () => {
    const title = one(item(`${'a'.repeat(199)}😀 tail`)).title;
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(title)).toBe(false);
  });
});
