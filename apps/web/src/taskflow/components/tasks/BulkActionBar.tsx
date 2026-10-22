// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CheckCheck, CircleDot, Flag, FolderKanban, Trash2, X } from 'lucide-react';
import { useData } from '../../store/DataContext';
import { useUI } from '../../store/UIContext';
import { useTaskActions } from '../../hooks/useTaskActions';
import { useClickOutside } from '../../hooks/useClickOutside';
import { isAnyLayerOpen } from '../../hooks/useLayer';
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../../lib/tasks';
import { addDays, toISODate } from '../../lib/date';
import { isTypingTarget } from '../../lib/utils';
import { Menu } from '../ui/Menu';

/** Floating toolbar for acting on every selected task at once. */
export function BulkActionBar() {
  const { selectedIds, clearSelection } = useUI();
  const { tasks, projects } = useData();
  const actions = useTaskActions();
  const ids = selectedIds.filter((id) => tasks.some((t) => t.id === id));
  const count = ids.length;

  useEffect(() => {
    if (!count) return;
    const onKey = (e: KeyboardEvent) => {
      // Listening on window runs after popovers/dialogs (on document), which mark Escape as handled.
      if (e.key === 'Escape' && !e.defaultPrevented && !isAnyLayerOpen() && !isTypingTarget(e.target)) clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, clearSelection]);

  const apply = (patch: Parameters<typeof actions.bulkUpdate>[1], label: string) => actions.bulkUpdate(ids, patch, label);
  const allDone = count > 0 && ids.every((id) => tasks.find((t) => t.id === id)?.status === 'done');

  return createPortal(
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="toolbar"
          aria-label={`Bulk actions for ${count} selected tasks`}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-max items-center gap-0.5 rounded-2xl sm:gap-1 border border-slate-200/80 bg-white/95 p-1.5 shadow-pop backdrop-blur sm:bottom-6 lg:left-[var(--sidebar-w)] dark:border-white/10 dark:bg-ink-800/95"
        >
          <span className="flex shrink-0 items-center gap-2 py-1 pl-2.5 pr-2 text-[13px] font-semibold text-slate-900 dark:text-white">
            <span className="grid h-6 min-w-[24px] place-items-center rounded-md bg-violet-600 px-1.5 text-xs text-white">{count}</span>
            <span className="hidden sm:inline">selected</span>
          </span>
          <Divider />
          <button
            className="btn-ghost btn-sm shrink-0"
            onClick={() => apply({ status: allDone ? 'todo' : 'done' }, allDone ? 'reopened' : 'completed')}
          >
            <CheckCheck className="h-4 w-4" /> <span className="hidden sm:inline">{allDone ? 'Reopen' : 'Complete'}</span>
          </button>
          <Menu
            placement="top"
            align="left"
            items={STATUSES.map((s) => ({ label: STATUS_META[s].label, icon: CircleDot, onSelect: () => apply({ status: s }, `moved to ${STATUS_META[s].label}`) }))}
            trigger={(p) => (
              <button {...p} className="btn-ghost btn-sm shrink-0" aria-label="Set status">
                <CircleDot className="h-4 w-4" /> <span className="hidden sm:inline">Status</span>
              </button>
            )}
          />
          <Menu
            placement="top"
            align="left"
            items={PRIORITIES.map((p) => ({ label: PRIORITY_META[p].label, icon: Flag, onSelect: () => apply({ priority: p }, `set to ${PRIORITY_META[p].label}`) }))}
            trigger={(p) => (
              <button {...p} className="btn-ghost btn-sm shrink-0" aria-label="Set priority">
                <Flag className="h-4 w-4" /> <span className="hidden sm:inline">Priority</span>
              </button>
            )}
          />
          <Menu
            placement="top"
            align="left"
            items={[
              { label: 'No project', icon: FolderKanban, onSelect: () => apply({ projectId: null }, 'removed from project') },
              ...projects.map((p) => ({ label: p.name, icon: FolderKanban, onSelect: () => apply({ projectId: p.id }, `moved to ${p.name}`) })),
            ]}
            trigger={(p) => (
              <button {...p} className="btn-ghost btn-sm shrink-0" aria-label="Move to project">
                <FolderKanban className="h-4 w-4" /> <span className="hidden sm:inline">Project</span>
              </button>
            )}
          />
          <DueDatePicker onPick={(date, label) => apply({ dueDate: date, ...(date ? {} : { dueTime: null, recurrence: null }) }, label)} />
          <Divider />
          <button
            className="btn-ghost btn-sm shrink-0 text-rose-600 hover:!bg-rose-50 hover:!text-rose-700 dark:text-rose-400 dark:hover:!bg-rose-500/10"
            onClick={() => void actions.bulkDelete(ids)}
          >
            <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
          </button>
          <button className="btn-icon h-8 w-8 shrink-0" aria-label="Clear selection (Esc)" title="Clear selection (Esc)" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200 dark:bg-white/10" />;
}

function DueDatePicker({ onPick }: { onPick: (date: string | null, label: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const today = new Date();
  const quick: { label: string; date: string | null; verb: string }[] = [
    { label: 'Today', date: toISODate(today), verb: 'due today' },
    { label: 'Tomorrow', date: toISODate(addDays(today, 1)), verb: 'due tomorrow' },
    { label: 'Next week', date: toISODate(addDays(today, 7)), verb: 'due next week' },
    { label: 'No date', date: null, verb: 'cleared' },
  ];
  const pick = (date: string | null, verb: string) => {
    setOpen(false);
    onPick(date, verb);
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost btn-sm shrink-0" aria-expanded={open} aria-label="Set due date" onClick={() => setOpen((o) => !o)}>
        <CalendarDays className="h-4 w-4" /> <span className="hidden sm:inline">Due date</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.1 } }}
            className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-xl border border-slate-200/80 bg-white p-1 shadow-pop dark:border-white/10 dark:bg-ink-800"
          >
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={() => pick(q.date, q.verb)}
                className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              >
                {q.label}
              </button>
            ))}
            <div className="mt-1 border-t border-slate-100 p-1.5 pt-2 dark:border-white/[0.06]">
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Pick a date</label>
              <input
                type="date"
                className="input h-8 text-[13px]"
                onChange={(e) => e.target.value && pick(e.target.value, `due ${e.target.value}`)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
