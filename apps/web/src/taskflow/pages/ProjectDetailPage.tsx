// @ts-nocheck
import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Clock3, FolderX, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useUI } from '../store/UIContext';
import { projectStats } from '../lib/stats';
import { formatShortDate } from '../lib/date';
import { sortTasks } from '../lib/tasks';
import { PageHeader } from '../components/layout/PageHeader';
import { TaskRow } from '../components/tasks/TaskRow';
import { BulkActionBar } from '../components/tasks/BulkActionBar';
import { SelectAllBar } from '../components/tasks/SelectAllBar';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressRing } from '../components/ui/Progress';
import { Segmented } from '../components/ui/Controls';
import { StatCard } from '../components/ui/StatCard';
import { useTaskActions } from '../hooks/useTaskActions';
import { useListKeyboard } from '../hooks/useListKeyboard';

type Tab = 'open' | 'done' | 'all';

export function ProjectDetailPage({ id }: { id: string }) {
  const { projects, tasks } = useData();
  const { now, navigate, openProjectForm, openTaskForm } = useUI();
  const { requestDeleteProject } = useTaskActions();
  const [tab, setTab] = useState<Tab>('open');
  useListKeyboard();
  const project = projects.find((p) => p.id === id);

  const projectTasks = useMemo(
    () => sortTasks(tasks.filter((t) => t.projectId === id), { key: 'dueDate', reversed: false }),
    [tasks, id],
  );

  if (!project) {
    return (
      <div className="card">
        <EmptyState
          icon={FolderX}
          title="Project not found"
          description="It may have been deleted."
          action={
            <button className="btn-secondary" onClick={() => navigate({ name: 'projects' })}>
              <ArrowLeft className="h-4 w-4" /> Back to projects
            </button>
          }
        />
      </div>
    );
  }

  const stats = projectStats(project.id, tasks, now);
  const shown = projectTasks.filter((t) => (tab === 'all' ? true : tab === 'done' ? t.status === 'done' : t.status !== 'done'));

  return (
    <>
      <button className="btn-ghost btn-sm -ml-2 mb-3" onClick={() => navigate({ name: 'projects' })}>
        <ArrowLeft className="h-4 w-4" /> Projects
      </button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="h-4 w-4 shrink-0 rounded-md" style={{ backgroundColor: project.color }} />
            <span className="truncate">{project.name}</span>
          </span>
        }
        description={project.description || `Created ${formatShortDate(new Date(project.createdAt), now)}`}
        actions={
          <>
            <button className="btn-secondary" onClick={() => openProjectForm(project.id)}>
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              className="btn-secondary hover:!border-rose-200 hover:!text-rose-600"
              onClick={async () => {
                if (await requestDeleteProject(project)) navigate({ name: 'projects' });
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <button className="btn-primary" onClick={() => openTaskForm({ defaults: { projectId: project.id } })}>
              <Plus className="h-4 w-4" /> Add task
            </button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="card flex items-center gap-5 p-5">
          <ProgressRing value={stats.progress} size={104} stroke={10} color={project.color} label="Project progress">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.progress}%</div>
              <div className="text-[11px] text-slate-500">complete</div>
            </div>
          </ProgressRing>
          <div className="text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">Progress</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {stats.total === 0 ? 'No tasks yet' : `${stats.completed} of ${stats.total} tasks done`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard index={0} label="Total" value={stats.total} icon={ListTodo} tone="violet" />
          <StatCard index={1} label="Completed" value={stats.completed} icon={CheckCircle2} tone="emerald" />
          <StatCard index={2} label="In progress" value={stats.inProgress} icon={Clock3} tone="amber" />
          <StatCard index={3} label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="rose" />
        </div>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]">
          <h2 className="section-title">Tasks</h2>
          <Segmented
            size="sm"
            label="Filter project tasks"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'open', label: `Open (${stats.total - stats.completed})` },
              { value: 'done', label: `Done (${stats.completed})` },
              { value: 'all', label: `All (${stats.total})` },
            ]}
          />
        </div>
        {shown.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={stats.total === 0 ? 'No tasks in this project' : tab === 'open' ? 'Everything is done!' : 'Nothing here yet'}
            description={stats.total === 0 ? 'Add the first task to get this project moving.' : undefined}
            action={
              <button className="btn-primary btn-sm" onClick={() => openTaskForm({ defaults: { projectId: project.id } })}>
                <Plus className="h-4 w-4" /> Add task
              </button>
            }
          />
        ) : (
          <div className="p-2 sm:p-3">
            <SelectAllBar ids={shown.map((t) => t.id)} />
            <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((t) => (
                <TaskRow key={t.id} task={t} project={project} showProject={false} selectable />
              ))}
            </AnimatePresence>
            </div>
          </div>
        )}
      </section>
      <BulkActionBar />
    </>
  );
}
