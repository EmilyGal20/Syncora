// @ts-nocheck
import type { Priority } from '../../types';
import type { GoalKind } from './types';

export interface StepTemplate {
  title: string;
  description: string;
  priority: Priority;
  estimateMinutes: number;
  /** Where the step falls between today (0) and the deadline (1). */
  offset: number;
  subtasks: string[];
}

export const TEMPLATES: Record<GoalKind, StepTemplate[]> = {
  project: [
    {
      title: 'Define scope and success criteria',
      description: 'Decide what is in and out, and what “done” looks like.',
      priority: 'high',
      estimateMinutes: 45,
      offset: 0,
      subtasks: ['List the must-have features', 'Write down what “done” means', 'Note open questions'],
    },
    {
      title: 'Plan the work',
      description: 'Break the work into small steps and order them.',
      priority: 'medium',
      estimateMinutes: 60,
      offset: 0.15,
      subtasks: ['Split features into steps', 'Order steps by dependency', 'Estimate each step'],
    },
    {
      title: 'Build core functionality',
      description: 'Focus on the most important part first.',
      priority: 'high',
      estimateMinutes: 180,
      offset: 0.45,
      subtasks: ['Set up the workspace', 'Implement the main feature', 'Save progress regularly'],
    },
    {
      title: 'Test and fix issues',
      description: 'Try the main flows and fix what breaks.',
      priority: 'high',
      estimateMinutes: 120,
      offset: 0.7,
      subtasks: ['Test the main flows', 'Fix blocking bugs', 'Check edge cases'],
    },
    {
      title: 'Polish and review',
      description: 'Clean up rough edges and get a second opinion.',
      priority: 'medium',
      estimateMinutes: 60,
      offset: 0.85,
      subtasks: ['Tidy up details', 'Ask someone for feedback'],
    },
    {
      title: 'Deliver and wrap up',
      description: 'Hand it over and note what to do next.',
      priority: 'medium',
      estimateMinutes: 30,
      offset: 1,
      subtasks: ['Share or submit the result', 'Write down follow-ups'],
    },
  ],
  study: [
    {
      title: 'Gather materials',
      description: 'Collect notes, slides and the list of topics.',
      priority: 'high',
      estimateMinutes: 30,
      offset: 0,
      subtasks: ['Collect notes and slides', 'List the topics to cover'],
    },
    {
      title: 'Make a study schedule',
      description: 'Spread the topics over the days you have.',
      priority: 'medium',
      estimateMinutes: 30,
      offset: 0.1,
      subtasks: ['Rank topics by difficulty', 'Block study time in your calendar'],
    },
    {
      title: 'Review key topics',
      description: 'Work through the topics, hardest first.',
      priority: 'high',
      estimateMinutes: 120,
      offset: 0.45,
      subtasks: ['Summarise each topic', 'Mark what is still unclear'],
    },
    {
      title: 'Practice with exercises',
      description: 'Use past papers or exercises to test yourself.',
      priority: 'high',
      estimateMinutes: 90,
      offset: 0.75,
      subtasks: ['Do a practice set', 'Review your mistakes'],
    },
    {
      title: 'Final review',
      description: 'A light pass over your summaries, then rest.',
      priority: 'medium',
      estimateMinutes: 60,
      offset: 1,
      subtasks: ['Skim your summaries', 'Prepare what you need for the day'],
    },
  ],
  writing: [
    {
      title: 'Outline',
      description: 'Decide the main points and their order.',
      priority: 'high',
      estimateMinutes: 45,
      offset: 0,
      subtasks: ['Write the main message in one sentence', 'List sections'],
    },
    {
      title: 'Research and collect sources',
      description: 'Gather the facts, quotes and references you need.',
      priority: 'medium',
      estimateMinutes: 60,
      offset: 0.2,
      subtasks: ['Find sources', 'Save key quotes and references'],
    },
    {
      title: 'Write the first draft',
      description: 'Get everything down without editing as you go.',
      priority: 'high',
      estimateMinutes: 180,
      offset: 0.55,
      subtasks: ['Draft the introduction', 'Draft the main sections', 'Draft the conclusion'],
    },
    {
      title: 'Revise and edit',
      description: 'Improve structure and clarity.',
      priority: 'medium',
      estimateMinutes: 90,
      offset: 0.8,
      subtasks: ['Read it start to finish', 'Cut what does not help'],
    },
    {
      title: 'Proofread and submit',
      description: 'Check spelling, formatting and references.',
      priority: 'medium',
      estimateMinutes: 30,
      offset: 1,
      subtasks: ['Check spelling and formatting', 'Submit or publish'],
    },
  ],
  event: [
    {
      title: 'Set budget and guest list',
      description: 'Decide how much to spend and who to invite.',
      priority: 'high',
      estimateMinutes: 45,
      offset: 0,
      subtasks: ['Set a budget', 'Draft the guest list'],
    },
    {
      title: 'Book venue and suppliers',
      description: 'Reserve the place and anything you need to order.',
      priority: 'high',
      estimateMinutes: 90,
      offset: 0.2,
      subtasks: ['Compare options', 'Make the bookings'],
    },
    {
      title: 'Send invitations',
      description: 'Invite people and track replies.',
      priority: 'medium',
      estimateMinutes: 30,
      offset: 0.35,
      subtasks: ['Send invitations', 'Track replies'],
    },
    {
      title: 'Confirm details',
      description: 'Check bookings and prepare what you need.',
      priority: 'medium',
      estimateMinutes: 60,
      offset: 0.75,
      subtasks: ['Confirm bookings', 'Prepare a checklist for the day'],
    },
    {
      title: 'Final check',
      description: 'Go through the checklist one last time.',
      priority: 'high',
      estimateMinutes: 30,
      offset: 1,
      subtasks: ['Run through the checklist', 'Share final details with everyone'],
    },
  ],
  trip: [
    {
      title: 'Choose dates and budget',
      description: 'Pin down when you go and how much you want to spend.',
      priority: 'high',
      estimateMinutes: 30,
      offset: 0,
      subtasks: ['Fix the travel dates', 'Set a budget'],
    },
    {
      title: 'Book travel and accommodation',
      description: 'Reserve transport and a place to stay.',
      priority: 'high',
      estimateMinutes: 90,
      offset: 0.2,
      subtasks: ['Book transport', 'Book accommodation'],
    },
    {
      title: 'Plan the itinerary',
      description: 'List what you want to see and do each day.',
      priority: 'medium',
      estimateMinutes: 60,
      offset: 0.45,
      subtasks: ['Shortlist places to visit', 'Note opening hours and tickets'],
    },
    {
      title: 'Prepare documents and packing',
      description: 'Check ID, tickets and what to bring.',
      priority: 'medium',
      estimateMinutes: 45,
      offset: 0.8,
      subtasks: ['Check ID and travel documents', 'Write a packing list'],
    },
    {
      title: 'Final check before leaving',
      description: 'Confirm bookings and pack the last items.',
      priority: 'high',
      estimateMinutes: 30,
      offset: 1,
      subtasks: ['Confirm bookings and check-in', 'Pack and charge devices'],
    },
  ],
  generic: [
    {
      title: 'Clarify the outcome',
      description: 'Write down what finished looks like.',
      priority: 'high',
      estimateMinutes: 30,
      offset: 0,
      subtasks: ['Describe the result in one sentence'],
    },
    {
      title: 'Break it into steps',
      description: 'List the steps and put them in order.',
      priority: 'medium',
      estimateMinutes: 30,
      offset: 0.2,
      subtasks: ['List the steps', 'Pick the first step'],
    },
    {
      title: 'Do the main work',
      description: 'Work through the steps, most important first.',
      priority: 'high',
      estimateMinutes: 120,
      offset: 0.6,
      subtasks: ['Work on the first step', 'Check progress against the outcome'],
    },
    {
      title: 'Review and finish',
      description: 'Check the result and close any loose ends.',
      priority: 'medium',
      estimateMinutes: 45,
      offset: 1,
      subtasks: ['Review the result', 'Close loose ends'],
    },
  ],
};

/** "Build core functionality: website", or just the step title without a topic. */
export function titleWithTopic(title: string, topic: string): string {
  return topic ? `${title}: ${topic}` : title;
}
