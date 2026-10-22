// @ts-nocheck
import type { Activity, AppData, Priority, Project, Recurrence, Settings, Task, TaskStatus } from '../types';
import { addDays, toISODate } from './date';
import { uid } from './utils';

export const DEFAULT_SETTINGS: Settings = {
  userName: 'Alex',
  theme: 'light',
  dailyGoal: 5,
  weekStartsOn: 1,
  deadlineAlerts: true,
};

interface Seed {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  /** Due date offset from today, in days. */
  due?: number;
  time?: string;
  project?: number;
  category?: string;
  tags?: string[];
  subtasks?: [string, boolean][];
  notes?: string;
  recurrence?: Pick<Recurrence, 'frequency' | 'interval'>;
  /** Created N days ago. */
  createdAgo: number;
  /** Completed N days ago (done tasks only). */
  completedAgo?: number;
}

const PROJECTS: Omit<Project, 'id' | 'createdAt'>[] = [
  { name: 'Website Redesign', description: 'Refresh the marketing site with the new brand system and faster pages.', color: '#8b5cf6' },
  { name: 'Mobile App Launch', description: 'Ship v2.0 of the iOS and Android apps to the stores.', color: '#0ea5e9' },
  { name: 'Q4 Marketing', description: 'Campaigns, content and partnerships for the end-of-year push.', color: '#f59e0b' },
  { name: 'Personal Growth', description: 'Health, learning and life admin.', color: '#10b981' },
];

const SEEDS: Seed[] = [
  {
    title: 'Finalize homepage hero design',
    description: 'Incorporate feedback from the design review: tighter headline, product screenshot on the right, stronger CTA contrast.',
    status: 'in_progress', priority: 'urgent', due: 0, time: '15:00', project: 0, category: 'Design',
    tags: ['ui', 'review'], subtasks: [['Update headline copy', true], ['Export hero illustration', true], ['Dark mode variant', false]], createdAgo: 6,
  },
  {
    title: 'Write release notes for v2.0',
    description: 'Summarize the new features, bug fixes and migration notes for the app store listing.',
    status: 'todo', priority: 'high', due: 1, project: 1, category: 'Marketing', tags: ['release'], createdAgo: 3,
  },
  {
    title: 'Fix login crash on Android 14',
    description: 'Crashlytics shows a NullPointerException in AuthActivity when biometric prompt is cancelled.',
    status: 'in_progress', priority: 'urgent', due: -1, project: 1, category: 'Development', tags: ['bug', 'android'],
    subtasks: [['Reproduce on Pixel 8', true], ['Write regression test', false], ['Patch and verify', false]], createdAgo: 4,
  },
  {
    title: 'Plan Black Friday email sequence',
    description: 'Three emails: teaser, launch, last chance. Coordinate discount codes with sales.',
    status: 'todo', priority: 'high', due: 4, project: 2, category: 'Marketing', tags: ['email', 'campaign'],
    subtasks: [['Draft subject lines', false], ['Design email template', false], ['Set up segments', false]], createdAgo: 2,
  },
  {
    title: '30-minute morning run', status: 'todo', priority: 'medium', due: 0, time: '07:30', project: 3, category: 'Health', tags: ['habit'],
    recurrence: { frequency: 'daily', interval: 1 }, createdAgo: 1,
  },
  {
    title: 'Audit Core Web Vitals',
    description: 'Run Lighthouse on top 10 pages and log LCP/CLS issues in the tracker.',
    status: 'todo', priority: 'medium', due: 2, project: 0, category: 'Development', tags: ['performance'], createdAgo: 5,
  },
  {
    title: 'Prepare investor update deck', status: 'todo', priority: 'high', due: -2, category: 'Work', tags: ['finance'],
    recurrence: { frequency: 'monthly', interval: 1 }, notes: 'Include MRR, churn and the hiring plan.', createdAgo: 8,
  },
  {
    title: 'Book dentist appointment', status: 'todo', priority: 'low', due: 6, project: 3, category: 'Personal', createdAgo: 3,
  },
  {
    title: 'App Store screenshots', description: 'Six screenshots per device size with localized captions.',
    status: 'in_progress', priority: 'high', due: 3, project: 1, category: 'Design', tags: ['assets'],
    subtasks: [['iPhone 6.7"', true], ['iPhone 5.5"', false], ['iPad Pro', false]], createdAgo: 5,
  },
  { title: 'Read "Designing Data-Intensive Applications" ch. 5', status: 'todo', priority: 'low', due: 9, project: 3, category: 'Learning', tags: ['reading'], createdAgo: 4 },
  { title: 'Partner webinar outline', status: 'todo', priority: 'medium', due: 12, project: 2, category: 'Marketing', tags: ['webinar'], createdAgo: 1 },
  {
    title: 'Review pull requests', status: 'todo', priority: 'medium', due: 0, time: '11:00', category: 'Development', tags: ['code-review'],
    recurrence: { frequency: 'weekdays', interval: 1 }, createdAgo: 0,
  },
  { title: 'Organize team offsite agenda', status: 'todo', priority: 'low', category: 'Work', tags: ['team'], createdAgo: 2 },
  // Completed work spread across the last two weeks so charts have real history.
  { title: 'Set up design tokens in Figma', status: 'done', priority: 'high', due: -9, project: 0, category: 'Design', tags: ['design-system'], createdAgo: 14, completedAgo: 10 },
  { title: 'Migrate navigation to new component', status: 'done', priority: 'medium', due: -6, project: 0, category: 'Development', createdAgo: 12, completedAgo: 7 },
  { title: 'Beta testers feedback survey', status: 'done', priority: 'medium', due: -5, project: 1, category: 'Work', tags: ['research'], createdAgo: 11, completedAgo: 6 },
  { title: 'Configure push notifications', status: 'done', priority: 'high', due: -4, project: 1, category: 'Development', createdAgo: 10, completedAgo: 5 },
  { title: 'Draft Q4 content calendar', status: 'done', priority: 'high', due: -4, project: 2, category: 'Marketing', tags: ['content'], createdAgo: 9, completedAgo: 4 },
  { title: 'Renew domain and SSL', status: 'done', priority: 'urgent', due: -3, project: 0, category: 'Work', createdAgo: 7, completedAgo: 3 },
  { title: 'Weekly grocery run', status: 'done', priority: 'low', due: -3, project: 3, category: 'Personal', createdAgo: 4, completedAgo: 3 },
  { title: 'Record product demo video', status: 'done', priority: 'medium', due: -2, project: 2, category: 'Marketing', tags: ['video'], createdAgo: 6, completedAgo: 2 },
  { title: 'Update privacy policy', status: 'done', priority: 'medium', due: -1, project: 1, category: 'Work', tags: ['legal'], createdAgo: 5, completedAgo: 1 },
  { title: 'Yoga class', status: 'done', priority: 'low', due: -1, project: 3, category: 'Health', tags: ['habit'], createdAgo: 2, completedAgo: 1 },
  { title: 'Reply to customer escalations', status: 'done', priority: 'urgent', due: 0, category: 'Work', tags: ['support'], createdAgo: 1, completedAgo: 0 },
  { title: 'Sync with design team', status: 'done', priority: 'medium', due: 0, time: '09:30', project: 0, category: 'Work', createdAgo: 2, completedAgo: 0 },
];

/** A timestamp N days ago at a plausible working hour. */
function daysAgoAt(now: Date, days: number, hourSeed: number): string {
  const d = addDays(now, -days);
  const hour = 9 + (hourSeed % 8);
  d.setHours(hour, (hourSeed * 17) % 60, 0, 0);
  // Never place sample events in the future.
  return (d > now ? new Date(now.getTime() - (hourSeed + 1) * 60_000) : d).toISOString();
}

export function createSampleData(now = new Date()): AppData {
  const projects: Project[] = PROJECTS.map((p, i) => ({ ...p, id: uid('p_'), createdAt: daysAgoAt(now, 20 - i, i) }));

  const tasks: Task[] = SEEDS.map((s, i) => {
    const createdAt = daysAgoAt(now, s.createdAgo, i);
    const completedAt = s.status === 'done' ? daysAgoAt(now, s.completedAgo ?? 0, i + 3) : null;
    return {
      id: uid('t_'),
      title: s.title,
      description: s.description ?? '',
      status: s.status,
      priority: s.priority,
      dueDate: s.due === undefined ? null : toISODate(addDays(now, s.due)),
      dueTime: s.time ?? null,
      projectId: s.project === undefined ? null : projects[s.project].id,
      category: s.category ?? null,
      tags: s.tags ?? [],
      subtasks: (s.subtasks ?? []).map(([title, done]) => ({ id: uid('s_'), title, done })),
      notes: s.notes ?? '',
      recurrence: s.recurrence ? { ...s.recurrence, until: null, anchorDay: null } : null,
      order: (i + 1) * 1024,
      createdAt,
      updatedAt: completedAt && completedAt > createdAt ? completedAt : createdAt,
      completedAt,
    };
  });

  const activity: Activity[] = [
    ...projects.map((p) => ({
      id: uid('a_'), type: 'project_created' as const, message: `Created project “${p.name}”`, projectId: p.id, at: p.createdAt,
    })),
    ...tasks.map((t) => ({ id: uid('a_'), type: 'task_created' as const, message: `Created “${t.title}”`, taskId: t.id, at: t.createdAt })),
    ...tasks
      .filter((t) => t.completedAt)
      .map((t) => ({ id: uid('a_'), type: 'task_completed' as const, message: `Completed “${t.title}”`, taskId: t.id, at: t.completedAt! })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 100);

  return {
    version: 2,
    tasks,
    projects,
    activity,
    notifications: [
      {
        id: uid('n_'),
        key: 'welcome',
        kind: 'info',
        title: 'Welcome to TaskFlow',
        message: 'We added some sample tasks so you can explore. Press N to create your own.',
        at: now.toISOString(),
        read: false,
      },
    ],
    notificationKeys: ['welcome'],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createEmptyData(settings: Settings = DEFAULT_SETTINGS): AppData {
  return { version: 2, tasks: [], projects: [], activity: [], notifications: [], notificationKeys: [], settings: { ...settings } };
}
