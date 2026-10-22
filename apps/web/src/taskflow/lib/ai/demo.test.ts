// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { demoProvider, generateDemoPlan } from './demo';
import { validatePlan } from './validate';
import { resolveDeadline } from './deadline';
import type { PlanRequest } from './types';

const TODAY = '2026-10-11';
const req = (goal: string, deadline: string | null = null): PlanRequest => ({ goal, deadline, projectId: null, projectName: null, today: TODAY });

const ctxFor = (r: PlanRequest) => {
  const d = resolveDeadline(r);
  return { id: 'p', source: 'demo' as const, providerLabel: 'Demo plan', goal: r.goal, today: TODAY, effectiveDeadline: d.date, deadlineSource: d.source };
};

const GOALS = [
  'I want to finish my project by Thursday.',
  'Study for the chemistry exam in 2 weeks',
  'Write an essay about rivers',
  'Plan a birthday party next Friday',
  'Clean the garage',
  'Finish the website today',
];

describe('generateDemoPlan', () => {
  it('is deterministic', () => {
    for (const goal of GOALS) expect(generateDemoPlan(req(goal))).toEqual(generateDemoPlan(req(goal)));
  });

  it('keeps every date between today and the deadline', () => {
    for (const goal of GOALS) {
      const r = req(goal);
      const deadline = resolveDeadline(r).date;
      for (const s of generateDemoPlan(r).suggestions) {
        expect(s.dueDate >= TODAY).toBe(true);
        expect(s.dueDate <= deadline).toBe(true);
      }
    }
  });

  it('gives 4–6 steps with the topic in the title', () => {
    const plan = generateDemoPlan(req('I want to build a website by Thursday'));
    expect(plan.suggestions.length).toBeGreaterThanOrEqual(4);
    expect(plan.suggestions.length).toBeLessThanOrEqual(6);
    expect(plan.suggestions.map((s) => s.title)).toContain('Build core functionality: website');
  });

  it('escalates priorities when the deadline is 2 days away or less', () => {
    const relaxed = generateDemoPlan(req('Write an essay', '2026-10-25'));
    const rushed = generateDemoPlan(req('Write an essay', '2026-10-13'));
    expect(relaxed.suggestions[0].priority).toBe('high');
    expect(rushed.suggestions[0].priority).toBe('urgent');
    expect(rushed.suggestions[1].priority).toBe('high');
  });

  it('compresses the plan when the deadline is today', () => {
    const plan = generateDemoPlan(req('Finish my project today'));
    const full = generateDemoPlan(req('Finish my project', '2026-10-20'));
    expect(plan.suggestions.length).toBeLessThanOrEqual(4);
    expect(plan.suggestions.every((s) => s.dueDate === TODAY)).toBe(true);
    for (const s of plan.suggestions) {
      expect(s.estimateMinutes % 15).toBe(0);
      expect(s.estimateMinutes).toBeGreaterThanOrEqual(15);
    }
    // "Build core functionality" is 180 minutes normally, 90 when rushed.
    const build = (p: typeof plan) => p.suggestions.find((s) => s.title.startsWith('Build core'))!.estimateMinutes;
    expect(build(full)).toBe(180);
    expect(build(plan)).toBe(90);
  });

  it('lets an explicit deadline beat a phrase in the goal', () => {
    const plan = generateDemoPlan(req('Finish my project by Thursday', '2026-10-30'));
    const last = plan.suggestions[plan.suggestions.length - 1];
    expect(last.dueDate).toBe('2026-10-30');
  });

  it('defaults to a deadline one week out', () => {
    const plan = generateDemoPlan(req('Clean the garage'));
    expect(plan.suggestions[plan.suggestions.length - 1].dueDate).toBe('2026-10-18');
  });

  it('always passes validation without dropping items', () => {
    for (const goal of [...GOALS, 'x'.repeat(480) + ' project']) {
      const r = req(goal);
      const result = validatePlan(generateDemoPlan(r), ctxFor(r));
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.plan.warnings.filter((w) => w.code === 'item_dropped' || w.code === 'duplicate_removed')).toEqual([]);
      expect(result.plan.suggestions.length).toBe(generateDemoPlan(r).suggestions.length);
    }
  });
});

describe('demoProvider', () => {
  it('returns a labelled demo plan with the resolved deadline', async () => {
    const result = await demoProvider.generate(req('Finish my project by Thursday'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.source).toBe('demo');
    expect(result.plan.effectiveDeadline).toBe('2026-10-15');
    expect(result.plan.deadlineSource).toBe('parsed');
    expect(result.plan.suggestions[0].key).toBe('s0');
  });

  it('rejects an invalid request and honours an aborted signal', async () => {
    const bad = await demoProvider.generate(req('hi'));
    expect(bad.ok === false && bad.error.kind).toBe('invalid_request');
    const controller = new AbortController();
    controller.abort();
    const aborted = await demoProvider.generate(req('Clean the garage'), controller.signal);
    expect(aborted.ok === false && aborted.error.kind).toBe('aborted');
  });
});
