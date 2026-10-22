// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { classifyGoal, extractTopic } from './classify';

describe('classifyGoal', () => {
  it.each([
    ['I want to finish my project by Thursday', 'project'],
    ['Build a portfolio website', 'project'],
    ['Study for the biology exam', 'study'],
    ['Learn Spanish basics', 'study'],
    ['Write an essay on climate change', 'writing'],
    ['Finish the quarterly report', 'writing'],
    ['Plan a birthday party for Sam', 'event'],
    ['Organize a team offsite trip', 'event'],
    ['Plan a weekend trip to Lisbon', 'trip'],
    ['Plan my summer vacation in Greece', 'trip'],
    ['Clean the garage', 'generic'],
  ])('%s → %s', (goal, kind) => {
    expect(classifyGoal(goal)).toBe(kind);
  });

  it('uses the first matching kind in order (project, study, writing, event)', () => {
    expect(classifyGoal('Write documentation for the app')).toBe('project');
    expect(classifyGoal('Write a report for my course')).toBe('study');
    expect(classifyGoal('Write a blog post about my trip')).toBe('writing');
  });

  it('matches whole words only', () => {
    expect(classifyGoal('Clean up the happy garden')).toBe('generic');
  });
});

describe('extractTopic', () => {
  it('strips the deadline phrase and leading filler', () => {
    expect(extractTopic('I want to finish my project by Thursday.')).toBe('project');
    expect(extractTopic('I need to build a website next week')).toBe('website');
    expect(extractTopic('Study for my exam on Friday')).toBe('exam');
  });

  it('keeps the rest of the goal', () => {
    expect(extractTopic('Write a blog post about React in 5 days')).toBe('blog post about React');
  });

  it('caps the topic at 40 characters', () => {
    const topic = extractTopic('Prepare the complete onboarding handbook for every new engineer joining the team');
    expect(topic.length).toBeLessThanOrEqual(40);
    expect(topic.length).toBeGreaterThan(0);
  });

  it('returns an empty topic when nothing is left', () => {
    expect(extractTopic('Finish by tomorrow')).toBe('');
  });
});
