// @ts-nocheck
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ClipboardList, Plus, SearchX } from 'lucide-react';
import type { Task } from '../types';
import { useData } from '../store/DataContext';
import { useUI } from '../store/UIContext';
import { DUE_GROUP_LABELS, dueGroup, filterTasks, hasActiveFilters, sortTasks, type DueGroup } from '../lib/tasks';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/layout/PageHeader';
import { TaskToolbar, ViewSwitcher } from '../components/tasks/TaskToolbar';
import { TaskRow } from '../components/tasks/TaskRow';
import { BulkActionBar } from '../components/tasks/BulkActionBar';
import { SelectAllBar } from '../components/tasks/SelectAllBar';
import { EmptyState } from '../components/ui/EmptyState';
import { useListKeyboard } from '../hooks/useListKeyboard';

const GROUP_ORDER: DueGroup[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'];

export function TasksPage() {
  const { tasks, projects } = useData();
  const { filters, sort, now, openTaskForm, resetFilters } = useUI();
  const [showCompleted, setShowCompleted] = useState(false);
  useListKeyboard();

  const filtered = useMemo(() => sortTasks(filterTasks(tasks, filters, now, projects), sort), [tasks, filters, sort, now, projects]);
  const open = filtered.filter((t) => t.status !== 'done');
  const done = filtered.filter((t) => t.status === 'done');
  const completedExpanded = showCompleted || filters.status === 'done';

  const groups = useMemo(() => {
    if (sort.key !== 'dueDate' || sort.reversed) return [{ key: 'all', label: 'Open tasks', tasks: open }];
    return GROUP_ORDER.map((g) => ({ key: g, label: DUE_GROUP_LABELS[g], tasks: open.filter((t) => dueGroup(t, now) === g) })).filter(
      (g) => g.tasks.length > 0,
    );
  }, [open, sort, now]);

  const projectOf = (t: Task) => projects.find((p) => p.id === t.projectId);

  return (
    <>
      <PageHeader
        title="My Tasks"
        description={`${open.length} open · ${done.length} completed${hasActiveFilters(filters) ? ' (filtered)' : ''}`}
        actions={
          <>
            <ViewSwitcher />
            <button className="btn-primary" onClick={() => openTaskForm()}>
              <Plus className="h-4 w-4" /> New task
            </button>
          </>
        }
      />

      <div className="card">
        <div className="border-b border-slate-100 p-4 dark:border-white/[0.06]">
          <TaskToolbar />
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tasks yet"
            description="Create your first task to start organizing your work."
            action={
              <button className="btn-primary" onClick={() => openTaskForm()}>
                <Plus className="h-4 w-4" /> Create a task
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matching tasks"
            description="Try a different search term or adjust your filters."
            action={
              <button className="btn-secondary" onClick={resetFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="p-2 sm:p-3">
            <SelectAllBar ids={(completedExpanded ? filtered : open).map((t) => t.id)} />
            {groups.map((group) =>
              group.tasks.length === 0 ? null : (
                <section key={group.key} className="mb-2">
                  <h2
                    className={cn(
                      'flex items-center gap-2 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider',
                      group.key === 'overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500',
                    )}
                  >
                    {group.label}
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/5">{group.tasks.length}</span>
                  </h2>
                  <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
                    <AnimatePresence initial={false} mode="popLayout">
                      {group.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} project={projectOf(t)} selectable highlightSearch />
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              ),
            )}
            {open.length === 0 && done.length > 0 && filters.status !== 'done' && (
              <p className="px-3 py-6 text-center text-sm text-slate-500">All matching tasks are completed. Nice work!</p>
            )}

            {done.length > 0 && (
              <section className="mt-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  aria-expanded={completedExpanded}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  <ChevronDown className={cn('h-4 w-4 transition-transform', !completedExpanded && '-rotate-90')} />
                  Completed
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/5">{done.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {completedExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
                        <AnimatePresence initial={false} mode="popLayout">
                          {done.map((t) => (
                            <TaskRow key={t.id} task={t} project={projectOf(t)} selectable highlightSearch />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </div>
        )}
      </div>
      <BulkActionBar />
    </>
  );
}
