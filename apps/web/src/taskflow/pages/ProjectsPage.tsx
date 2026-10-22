// @ts-nocheck
import { AnimatePresence, motion } from 'framer-motion';
import { FolderKanban, Plus } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useUI } from '../store/UIContext';
import { projectStats } from '../lib/stats';
import { PageHeader } from '../components/layout/PageHeader';
import { ProjectCard } from '../components/projects/ProjectCard';
import { EmptyState } from '../components/ui/EmptyState';

export function ProjectsPage() {
  const { projects, tasks } = useData();
  const { now, openProjectForm } = useUI();

  return (
    <>
      <PageHeader
        title="Projects"
        description={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} · group related work and track progress`}
        actions={
          <button className="btn-primary" onClick={() => openProjectForm()}>
            <Plus className="h-4 w-4" /> New project
          </button>
        }
      />

      {projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Projects help you organize related tasks and see how close you are to done."
            action={
              <button className="btn-primary" onClick={() => openProjectForm()}>
                <Plus className="h-4 w-4" /> Create a project
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} stats={projectStats(p.id, tasks, now)} index={i} />
            ))}
          </AnimatePresence>
          <motion.button
            layout
            onClick={() => openProjectForm()}
            className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 transition hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-600 dark:border-white/10 dark:hover:border-violet-400/40 dark:hover:bg-violet-500/5 dark:hover:text-violet-300"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 transition group-hover:bg-violet-100 dark:bg-white/5 dark:group-hover:bg-violet-500/15">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">Create new project</span>
          </motion.button>
        </div>
      )}
    </>
  );
}
