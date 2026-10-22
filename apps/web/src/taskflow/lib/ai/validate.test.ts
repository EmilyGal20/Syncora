// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { summarizeWarnings, validatePlan, validateRequest, type ValidateContext } from './validate';
import type { PlanResult, PlanSuggestion } from './types';

const TODAY = '2026-10-11';
const ctx: ValidateContext = {
  id: 'plan_1',
  source: 'ai',
  providerLabel: 'AI planner',
  goal: 'Ship it',
  today: TODAY,
  effectiveDeadline: '2026-10-21',
  deadlineSource: 'explicit',
};

const item = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  description: '',
  priority: 'medium',
  estimateMinutes: 60,
  dueDate: '2026-10-15',
  subtasks: [],
  ...extra,
});

function ok(result: PlanResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.kind}`);
  return result.plan;
}
const run = (suggestions: unknown[], extra: Record<string, unknown> = {}) => validatePlan({ suggestions, ...extra }, ctx);
const only = (raw: Record<string, unknown>): PlanSuggestion => ok(run([raw])).suggestions[0];

describe('validatePlan envelope', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'hello'],
    ['no suggestions', { version: 1 }],
    ['suggestions not an array', { suggestions: {} }],
    ['an unknown version', { version: 2, suggestions: [item('A')] }],
  ])('rejects %s as malformed', (_label, raw) => {
    const result = validatePlan(raw, ctx);
    expect(result.ok === false && result.error.kind).toBe('malformed');
  });

  it('accepts version 1 or no version', () => {
    expect(run([item('A')], { version: 1 }).ok).toBe(true);
    expect(run([item('A')]).ok).toBe(true);
  });

  it('returns the empty error when nothing is usable', () => {
    const result = run([null, 42, { title: '' }, { title: '   ' }, { notATitle: 'x' }]);
    expect(result.ok === false && result.error.kind).toBe('empty');
    expect(run([]).ok === false).toBe(true);
  });
});

describe('validatePlan items', () => {
  it('drops unusable items and keeps the rest', () => {
    const plan = ok(run([item('Keep me'), 'string item', { title: 5 }, item('Also keep')]));
    expect(plan.suggestions.map((s) => s.title)).toEqual(['Keep me', 'Also keep']);
    expect(plan.warnings.filter((w) => w.code === 'item_dropped').map((w) => w.index)).toEqual([1, 2]);
  });

  it('repairs priority', () => {
    expect(only(item('A', { priority: 'HIGH ' })).priority).toBe('high');
    expect(only(item('A', { priority: 'critical' })).priority).toBe('medium');
    expect(only(item('A', { priority: undefined })).priority).toBe('medium');
  });

  it('rounds and clamps estimates', () => {
    expect(only(item('A', { estimateMinutes: 50 })).estimateMinutes).toBe(45);
    expect(only(item('A', { estimateMinutes: 53 })).estimateMinutes).toBe(60);
    expect(only(item('A', { estimateMinutes: 1 })).estimateMinutes).toBe(15);
    expect(only(item('A', { estimateMinutes: 10_000 })).estimateMinutes).toBe(480);
    expect(only(item('A', { estimateMinutes: 'abc' })).estimateMinutes).toBe(60);
    expect(only(item('A', { estimateMinutes: undefined })).estimateMinutes).toBe(60);
    expect(only(item('A', { estimateMinutes: Number.NaN })).estimateMinutes).toBe(60);
  });

  it('clamps dates to [today, deadline] and flags them', () => {
    const early = only(item('A', { dueDate: '2026-09-01' }));
    expect(early).toMatchObject({ dueDate: TODAY, dateAdjusted: true });
    const late = only(item('A', { dueDate: '2027-01-01' }));
    expect(late).toMatchObject({ dueDate: '2026-10-21', dateAdjusted: true });
    const fine = only(item('A', { dueDate: '2026-10-21' }));
    expect(fine).toMatchObject({ dueDate: '2026-10-21', dateAdjusted: false });
  });

  it('spreads invalid and missing dates evenly', () => {
    const plan = ok(run([item('A', { dueDate: undefined }), item('B', { dueDate: 'soon' })]));
    expect(plan.suggestions.map((s) => [s.title, s.dueDate, s.dateAdjusted])).toEqual([
      ['A', '2026-10-16', false],
      ['B', '2026-10-21', true],
    ]);
  });

  it('truncates long text', () => {
    const s = only(item('T'.repeat(300), { description: 'D'.repeat(1500) }));
    expect(s.title).toHaveLength(200);
    expect(s.description).toHaveLength(1000);
  });

  it('caps and dedupes subtasks', () => {
    const subs = ['One', 'one', ' ONE! ', '', 7, ...Array.from({ length: 12 }, (_, i) => `Step ${i}`)];
    const s = only(item('A', { subtasks: subs }));
    expect(s.subtasks).toEqual(['One', 'Step 0', 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6']);
    expect(only(item('A', { subtasks: 'nope' })).subtasks).toEqual([]);
  });

  it('dedupes titles ignoring case and punctuation', () => {
    const plan = ok(run([item('Write the draft'), item('write the draft!'), item('Write — the  draft'), item('Other')]));
    expect(plan.suggestions.map((s) => s.title)).toEqual(['Write the draft', 'Other']);
    expect(plan.warnings.filter((w) => w.code === 'duplicate_removed')).toHaveLength(2);
  });

  it('keeps at most 10 suggestions', () => {
    const plan = ok(run(Array.from({ length: 15 }, (_, i) => item(`Task ${i}`))));
    expect(plan.suggestions).toHaveLength(10);
    expect(plan.warnings.some((w) => w.code === 'too_many')).toBe(true);
  });

  it('only scans the first 50 raw items', () => {
    const raw = [...Array.from({ length: 50 }, () => null), item('Too late')];
    const result = run(raw);
    expect(result.ok === false && result.error.kind).toBe('empty');
  });

  it('strips control characters and list markers', () => {
    const s = only(item('1. \u0007Fix‮ the\u0000 bug', { description: 'Line one\nLine\u0008 two', subtasks: ['- \u001bsub'] }));
    expect(s.title).toBe('Fix the bug');
    expect(s.description).toBe('Line one\nLine two');
    expect(s.subtasks).toEqual(['sub']);
    expect(only(item('- [ ] Buy milk')).title).toBe('Buy milk');
    expect(only(item('e.g. this stays')).title).toBe('e.g. this stays');
  });

  it('keeps markup as literal text', () => {
    const s = only(item('<script>alert(1)</script>', { description: '<img src=x onerror=alert(1)>' }));
    expect(s.title).toBe('<script>alert(1)</script>');
    expect(s.description).toBe('<img src=x onerror=alert(1)>');
  });

  it('sorts by date, then priority, then original order, with keys s0…', () => {
    const plan = ok(
      run([
        item('Later', { dueDate: '2026-10-20', priority: 'urgent' }),
        item('Same day low', { dueDate: '2026-10-12', priority: 'low' }),
        item('Same day high', { dueDate: '2026-10-12', priority: 'high' }),
        item('Same day high 2', { dueDate: '2026-10-12', priority: 'high' }),
      ]),
    );
    expect(plan.suggestions.map((s) => [s.key, s.title])).toEqual([
      ['s0', 'Same day high'],
      ['s1', 'Same day high 2'],
      ['s2', 'Same day low'],
      ['s3', 'Later'],
    ]);
  });

  it('ignores the provider label and keeps the context', () => {
    const plan = ok(run([item('A')], { providerLabel: '<b>Trust me</b>' }));
    expect(plan.providerLabel).toBe('AI planner');
    expect(plan).toMatchObject({ id: 'plan_1', source: 'ai', effectiveDeadline: '2026-10-21', deadlineSource: 'explicit' });
  });
});

describe('summarizeWarnings', () => {
  it('counts adjusted and removed suggestions', () => {
    expect(summarizeWarnings([])).toBeNull();
    expect(
      summarizeWarnings([
        { code: 'date_adjusted', index: 0 },
        { code: 'field_repaired', index: 0 },
        { code: 'text_truncated', index: 2 },
        { code: 'item_dropped', index: 3 },
      ]),
    ).toBe('2 suggestions were adjusted · 1 was removed');
  });
});

describe('validateRequest', () => {
  const base = { goal: 'Finish my project', deadline: null, projectId: null, projectName: null, today: TODAY };

  it('accepts a valid request and trims the goal', () => {
    const r = validateRequest({ ...base, goal: '  Finish my project  ', projectName: '  Site ' });
    expect(r).toEqual({ ok: true, request: { ...base, projectName: 'Site' } });
  });

  it('checks goal length after trimming', () => {
    expect(validateRequest({ ...base, goal: '  ab  ' })).toMatchObject({ ok: false, field: 'goal', message: 'Describe your goal first.' });
    expect(validateRequest({ ...base, goal: 'x'.repeat(501) })).toMatchObject({ ok: false, field: 'goal', message: 'Keep your goal under 500 characters.' });
    expect(validateRequest({ ...base, goal: 'x'.repeat(500) }).ok).toBe(true);
  });

  it('checks the deadline', () => {
    expect(validateRequest({ ...base, deadline: TODAY }).ok).toBe(true);
    expect(validateRequest({ ...base, deadline: '2026-10-10' })).toMatchObject({ ok: false, field: 'deadline', message: 'Pick today or a later date.' });
    expect(validateRequest({ ...base, deadline: '2026-02-30' })).toMatchObject({ ok: false, field: 'deadline' });
    expect(validateRequest({ ...base, deadline: '2027-10-11' }).ok).toBe(true);
    expect(validateRequest({ ...base, deadline: '2027-10-12' })).toMatchObject({ ok: false, field: 'deadline' });
  });
});
