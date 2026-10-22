// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { addDays, parseISODate, toISODate } from '../date';
import { demoProvider, generateDemoPlan } from './demo';
import { resolveDeadline } from './deadline';
import { validatePlan } from './validate';
import type { PlanRequest } from './types';

// Table-driven invariants for the demo generator across many goals, todays and deadlines.
const TODAYS = ['2026-10-11', '2026-12-30', '2026-12-31', '2027-02-28', '2028-02-28', '2027-03-13', '2026-01-31'];

const GOALS = [
  'I want to finish my project by Thursday.',
  'Build a portfolio website',
  'Study for the chemistry exam in 2 weeks',
  'Learn Spanish basics',
  'Write an essay about rivers by end of month',
  'Draft the quarterly report tomorrow',
  'Plan a birthday party next Friday',
  'Organise the team offsite',
  'Clean the garage',
  'Finish the website today',
  'לסיים את הפרויקט',
  'Launch 🚀 the new app',
  'abc',
  `${'very long goal '.repeat(32)}project`.slice(0, 500),
  '<script>alert(1)</script> project',
  'Finish by 2026-02-30 somehow',
];

const plus = (today: string, n: number) => toISODate(addDays(parseISODate(today), n));
const deadlinesFor = (today: string): (string | null)[] => [null, today, plus(today, 1), plus(today, 2), plus(today, 30), plus(today, 365)];

const cases: [string, string, string | null][] = [];
for (const today of TODAYS) for (const goal of GOALS) for (const deadline of deadlinesFor(today)) cases.push([today, goal, deadline]);

const req = (today: string, goal: string, deadline: string | null): PlanRequest => ({ goal, deadline, projectId: null, projectName: null, today });

describe('generateDemoPlan invariants', () => {
  it(`covers ${cases.length} combinations`, () => {
    expect(cases.length).toBe(TODAYS.length * GOALS.length * 6);
  });

  it('is deterministic and stays within every limit for every combination', () => {
    for (const [today, goal, deadline] of cases) {
      const r = req(today, goal, deadline);
      const label = `${today} | ${deadline} | ${goal.slice(0, 30)}`;
      const raw = generateDemoPlan(r);
      expect(generateDemoPlan(r), label).toEqual(raw);

      const { date: effective, source } = resolveDeadline(r);
      expect(effective >= today, label).toBe(true);
      expect(raw.suggestions.length, label).toBeGreaterThanOrEqual(1);
      expect(raw.suggestions.length, label).toBeLessThanOrEqual(10);

      for (const s of raw.suggestions) {
        expect(s.dueDate >= today && s.dueDate <= effective, `${label}: ${s.dueDate}`).toBe(true);
        expect(s.title.length, label).toBeGreaterThanOrEqual(1);
        expect(s.title.length, label).toBeLessThanOrEqual(200);
        expect(s.estimateMinutes % 15, label).toBe(0);
        expect(s.estimateMinutes, label).toBeGreaterThanOrEqual(15);
        expect(s.estimateMinutes, label).toBeLessThanOrEqual(480);
        expect(s.subtasks.length, label).toBeLessThanOrEqual(8);
      }

      // Due dates never go backwards through the plan.
      const dates = raw.suggestions.map((s) => s.dueDate);
      expect([...dates].sort(), label).toEqual(dates);

      // The demo's own output passes validation untouched: nothing dropped, moved or repaired.
      const result = validatePlan(raw, { id: 'p', source: 'demo', providerLabel: 'Demo plan', goal, today, effectiveDeadline: effective, deadlineSource: source });
      expect(result.ok, label).toBe(true);
      if (result.ok) {
        expect(result.plan.warnings, label).toEqual([]);
        expect(result.plan.suggestions.map((s) => s.title).sort(), label).toEqual(raw.suggestions.map((s) => s.title).sort());
      }
    }
  });

  it('always puts the last step on the effective deadline', () => {
    for (const [today, goal, deadline] of cases) {
      const r = req(today, goal, deadline);
      const raw = generateDemoPlan(r);
      expect(raw.suggestions[raw.suggestions.length - 1].dueDate).toBe(resolveDeadline(r).date);
    }
  });
});

describe('demoProvider determinism', () => {
  it('returns the same suggestions for the same request (only the plan id differs)', async () => {
    for (const today of TODAYS) {
      for (const goal of GOALS) {
        const a = await demoProvider.generate(req(today, goal, null));
        const b = await demoProvider.generate(req(today, goal, null));
        expect(a.ok && b.ok).toBe(true);
        if (!a.ok || !b.ok) continue;
        expect(a.plan.id).not.toBe(b.plan.id);
        expect(b.plan.suggestions).toEqual(a.plan.suggestions);
        expect(a.plan.source).toBe('demo');
        expect(a.plan.providerLabel).toBe('Demo plan');
      }
    }
  });
});
