// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Circle, CornerDownLeft, FolderPlus, Keyboard, Moon, Plus, Search, Settings, type LucideIcon } from 'lucide-react';
import { useData } from '../../store/DataContext';
import { useUI } from '../../store/UIContext';
import { useLayer } from '../../hooks/useLayer';
import { matchesSearch, searchScore } from '../../lib/tasks';
import { formatDueLabel } from '../../lib/date';
import { cn } from '../../lib/utils';
import { NAV_ITEMS } from '../layout/Sidebar';

interface Command {
  id: string;
  group: 'Actions' | 'Navigation' | 'Tasks' | 'Projects';
  label: string;
  hint?: string;
  icon: LucideIcon;
  color?: string;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useUI();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setPaletteOpen(false);
  useLayer(paletteOpen, close, panelRef);

  return createPortal(
    <AnimatePresence>
      {paletteOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[10vh] sm:pt-[14vh]">
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search and commands"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-pop dark:border-white/10 dark:bg-ink-800"
          >
            <PaletteBody onClose={close} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const { tasks, projects, updateSettings } = useData();
  const { navigate, openTaskForm, openTaskDetail, openProjectForm, setShortcutsOpen, isDark, now } = useUI();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    const textMatch = (s: string) => !q || s.toLowerCase().includes(q);

    const actions = ([
      { id: 'new-task', group: 'Actions', label: query.trim() ? `Create task “${query.trim()}”` : 'Create new task', icon: Plus, hint: 'N',
        run: () => openTaskForm(query.trim() ? { defaults: { title: query.trim() } } : undefined) },
      { id: 'new-project', group: 'Actions', label: 'Create new project', icon: FolderPlus, hint: 'Shift P', run: () => openProjectForm() },
      { id: 'theme', group: 'Actions', label: isDark ? 'Switch to light mode' : 'Switch to dark mode', icon: Moon, hint: 'Shift D',
        run: () => updateSettings({ theme: isDark ? 'light' : 'dark' }) },
      { id: 'shortcuts', group: 'Actions', label: 'Keyboard shortcuts', icon: Keyboard, hint: '?', run: () => setShortcutsOpen(true) },
    ] as Command[]).filter((c) => c.id === 'new-task' || textMatch(c.label));

    const nav = ([
      ...NAV_ITEMS.map((n) => ({ id: `nav-${n.name}`, group: 'Navigation' as const, label: `Go to ${n.label}`, icon: n.icon, hint: n.shortcut, run: () => navigate({ name: n.name }) })),
      { id: 'nav-settings', group: 'Navigation', label: 'Go to Settings', icon: Settings, hint: 'G S', run: () => navigate({ name: 'settings' }) },
    ] as Command[]).filter((c) => textMatch(c.label));

    const matchedTasks = (q ? tasks.filter((t) => matchesSearch(t, q, projects)).sort((a, b) => searchScore(b, q) - searchScore(a, q)) : [...tasks].filter((t) => t.status !== 'done').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      .slice(0, q ? 8 : 5)
      .map<Command>((t) => ({
        id: `task-${t.id}`,
        group: 'Tasks',
        label: t.title,
        hint: t.dueDate ? formatDueLabel(t.dueDate, t.dueTime, now) : undefined,
        icon: t.status === 'done' ? CheckCircle2 : Circle,
        color: projects.find((p) => p.id === t.projectId)?.color,
        run: () => openTaskDetail(t.id),
      }));

    const matchedProjects = projects
      .filter((p) => q && textMatch(p.name))
      .slice(0, 5)
      .map<Command>((p) => ({ id: `project-${p.id}`, group: 'Projects', label: p.name, icon: Circle, color: p.color, run: () => navigate({ name: 'project', id: p.id }) }));

    return q ? [...matchedTasks, ...matchedProjects, ...actions, ...nav] : [...actions, ...matchedTasks, ...nav];
  }, [query, tasks, projects, isDark, now, navigate, openTaskForm, openTaskDetail, openProjectForm, setShortcutsOpen, updateSettings]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    // Let the palette unmount before opening the next layer so focus lands correctly.
    window.setTimeout(cmd.run, 0);
  };

  let lastGroup = '';
  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/[0.06]">
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(commands.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(commands[index]);
            }
          }}
          placeholder="Search tasks, projects or type a command…"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={commands[index] ? `cmd-${commands[index].id}` : undefined}
          className="h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        {commands.length === 0 && <p className="px-3 py-10 text-center text-sm text-slate-500">No results for “{query}”</p>}
        {commands.map((cmd, i) => {
          const header = cmd.group !== lastGroup ? cmd.group : null;
          lastGroup = cmd.group;
          return (
            <div key={cmd.id}>
              {header && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</div>}
              <button
                id={`cmd-${cmd.id}`}
                data-index={i}
                role="option"
                aria-selected={i === index}
                onMouseMove={() => setIndex(i)}
                onClick={() => run(cmd)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  i === index ? 'bg-violet-50 text-violet-900 dark:bg-violet-500/15 dark:text-white' : 'text-slate-700 dark:text-slate-300',
                )}
              >
                <cmd.icon className="h-4 w-4 shrink-0" style={cmd.color ? { color: cmd.color } : undefined} />
                <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                {cmd.hint && <span className="shrink-0 text-xs text-slate-400">{cmd.hint}</span>}
                {i === index && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
