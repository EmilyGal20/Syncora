// @ts-nocheck
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Project } from '../../types';
import type { ProjectStats } from '../../lib/stats';
import { useUI } from '../../store/UIContext';
import { useTaskActions } from '../../hooks/useTaskActions';
import { ProgressRing } from '../ui/Progress';
import { Menu } from '../ui/Menu';

export function ProjectCard({ project, stats, index }: { project: Project; stats: ProjectStats; index: number }) {
  const { navigate, openProjectForm, openTaskForm } = useUI();
  const { requestDeleteProject } = useTaskActions();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => navigate({ name: 'project', id: project.id })}
      className="card-interactive group relative flex cursor-pointer flex-col overflow-hidden"
    >
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${project.color}, ${project.color}99)` }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: project.color }}
            aria-hidden
          >
            {project.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">
              <button
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({ name: 'project', id: project.id });
                }}
              >
                {project.name}
              </button>
            </h3>
            <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-slate-500 dark:text-slate-400">
              {project.description || 'No description'}
            </p>
          </div>
          <Menu
            items={[
              { label: 'Add task', icon: Plus, onSelect: () => openTaskForm({ defaults: { projectId: project.id } }) },
              { label: 'Edit project', icon: Pencil, onSelect: () => openProjectForm(project.id) },
              { label: 'Delete project', icon: Trash2, onSelect: () => void requestDeleteProject(project), danger: true },
            ]}
            trigger={(props) => (
              <button {...props} className="btn-icon -mr-2 -mt-1 h-8 w-8" aria-label={`Actions for ${project.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
          />
        </div>

        <div className="mt-5 flex items-center gap-4">
          <ProgressRing value={stats.progress} size={64} stroke={7} color={project.color} label={`${project.name} progress`}>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{stats.progress}%</span>
          </ProgressRing>
          <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
            <Stat icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} label="Done" value={stats.completed} />
            <Stat icon={<Clock3 className="h-3.5 w-3.5 text-amber-500" />} label="Active" value={stats.inProgress} />
            <Stat icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-500" />} label="Overdue" value={stats.overdue} />
          </dl>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
          <span>
            {stats.completed} of {stats.total} tasks completed
          </span>
          <span className="font-medium text-violet-600 opacity-0 transition group-hover:opacity-100 dark:text-violet-300">Open →</span>
        </div>
      </div>
    </motion.article>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-1 py-2 dark:bg-white/[0.03]">
      <dd className="text-base font-bold text-slate-900 dark:text-white">{value}</dd>
      <dt className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-slate-500">
        {icon}
        {label}
      </dt>
    </div>
  );
}
