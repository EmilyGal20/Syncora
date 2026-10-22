// @ts-nocheck
import { stripDeadlinePhrases } from './deadline';
import type { GoalKind } from './types';

const KEYWORDS: [Exclude<GoalKind, 'generic'>, string[]][] = [
  [
    'project',
    ['project', 'app', 'apps', 'website', 'site', 'build', 'develop', 'implement', 'feature', 'features', 'prototype',
      'mvp', 'launch', 'release', 'ship', 'code', 'coding', 'software', 'product', 'portfolio', 'redesign'],
  ],
  [
    'study',
    ['study', 'studying', 'exam', 'exams', 'test', 'learn', 'learning', 'course', 'class', 'revise', 'revision',
      'homework', 'quiz', 'lecture', 'certification', 'semester', 'finals', 'midterm', 'midterms'],
  ],
  [
    'writing',
    ['write', 'writing', 'essay', 'report', 'article', 'blog', 'paper', 'thesis', 'draft', 'proposal', 'book',
      'chapter', 'newsletter', 'documentation', 'story', 'post'],
  ],
  [
    'event',
    ['event', 'party', 'wedding', 'conference', 'meetup', 'birthday', 'organize', 'organise', 'host', 'celebration',
      'workshop', 'dinner', 'move', 'moving'],
  ],
  // After "event", so organizing a group trip still gets the event steps (invitations, bookings).
  [
    'trip',
    ['trip', 'trips', 'travel', 'travelling', 'traveling', 'vacation', 'holiday', 'holidays', 'getaway', 'journey',
      'flight', 'flights', 'backpacking', 'road trip'],
  ],
];

const PATTERNS = KEYWORDS.map(([kind, words]) => [kind, new RegExp(String.raw`\b(?:${words.join('|')})\b`, 'i')] as const);

/** Picks a template family. The first matching kind in the order above wins. */
export function classifyGoal(goal: string): GoalKind {
  for (const [kind, re] of PATTERNS) if (re.test(goal)) return kind;
  return 'generic';
}

const TOPIC_MAX = 40;
const LEADING = [
  /^(?:i\s+(?:really\s+)?(?:want|need|have|would\s+like|'d\s+like|’d\s+like|plan|am\s+going|'m\s+going|’m\s+going)\s+to|i\s+must|i\s+will|i'll|i’ll|please|help\s+me(?:\s+to)?|let's|let’s)(?:\s+|$)/i,
  /^(?:finally|finish|finishing|complete|completing|get|do|build|create|make|write|study\s+for|study|learn|prepare\s+for|plan|organi[sz]e|launch|ship|start|work\s+on)(?:\s+|$)/i,
  /^(?:my|our|the|a|an|this|that)(?:\s+|$)/i,
];

/** A short subject for step titles, e.g. "I want to finish my website by Friday" → "website". */
export function extractTopic(goal: string): string {
  let topic = stripDeadlinePhrases(goal).replace(/\s+/g, ' ').trim();
  topic = topic.replace(/[\s.,;:!?…-]+$/u, '');
  for (const re of LEADING) topic = topic.replace(re, '');
  topic = topic.trim();
  if (topic.length > TOPIC_MAX) {
    const cut = topic.slice(0, TOPIC_MAX);
    const space = cut.lastIndexOf(' ');
    topic = (space > TOPIC_MAX / 2 ? cut.slice(0, space) : cut).trim();
  }
  return topic.replace(/[\s.,;:!?…-]+$/u, '');
}
