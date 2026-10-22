// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownUp, CalendarRange, Columns3, List, ListFilter, Search, X } from 'lucide-react';
import type { TaskFilters } from '../../types';
import { useDataState } from '../../store/DataContext';
import { useUIActions, useUIState } from '../../store/UIContext';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
  DEFAULT_FILTERS,
  DUE_FILTER_OPTIONS,
  PRIORITIES,
  PRIORITY_META,
  SORT_OPTIONS,
  countActiveFilters,
  getCategories,
  getTags,
} from '../../lib/tasks';
import { cn } from '../../lib/utils';
import { Segmented, Select } from '../ui/Controls';

interface ToolbarProps {
  showStatus?: boolean;
  showSort?: boolean;
}

const STATUS_LABELS: Record<TaskFilters['status'], string> = {
  all: 'All statuses',
  open: 'Open',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Completed',
  overdue: 'Overdue',
};

export function TaskToolbar({ showStatus = true, showSort = true }: ToolbarProps) {
  const { tasks, projects } = useDataState();
  const { filters, sort } = useUIState();
  const { setFilters, resetFilters, setSort } = useUIActions();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState(filters.search);
  const panelRef = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  useClickOutside(panelRef, closePanel, panelOpen);

  const categories = useMemo(() => getCategories(tasks), [tasks]);
  const tags = useMemo(() => getTags(tasks), [tasks]);
  const activeCount = countActiveFilters(filters, !showStatus);

  // Debounce typing so large lists don't re-filter on every keystroke.
  useEffect(() => {
    if (draft === filters.search) return;
    const id = window.setTimeout(() => setFilters({ search: draft }), 150);
    return () => window.clearTimeout(id);
  }, [draft, filters.search, setFilters]);
  // Reflect outside changes (e.g. "Clear filters") in the input.
  useEffect(() => setDraft(filters.search), [filters.search]);

  const chips: { key: keyof TaskFilters; label: string }[] = [];
  if (showStatus && filters.status !== 'all') chips.push({ key: 'status', label: `Status: ${STATUS_LABELS[filters.status]}` });
  if (filters.priority !== 'all') chips.push({ key: 'priority', label: `Priority: ${PRIORITY_META[filters.priority].label}` });
  if (filters.due !== 'all') chips.push({ key: 'due', label: DUE_FILTER_OPTIONS.find((o) => o.value === filters.due)!.label });
  if (filters.projectId !== 'all')
    chips.push({
      key: 'projectId',
      label: `Project: ${filters.projectId === 'none' ? 'None' : projects.find((p) => p.id === filters.projectId)?.name ?? 'Unknown'}`,
    });
  if (filters.category !== 'all') chips.push({ key: 'category', label: `Category: ${filters.category}` });
  if (filters.tag !== 'all') chips.push({ key: 'tag', label: `#${filters.tag}` });

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && draft && (e.preventDefault(), setDraft(''))}
            placeholder="Search… try #tag"
            aria-label="Search tasks"
            className="input h-9 pl-9 pr-8 text-[13px] [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button
              aria-label="Clear search"
              onClick={() => setDraft('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            className={cn('btn-secondary h-9', activeCount > 0 && 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200')}
          >
            <ListFilter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-md bg-violet-600 px-1 text-[11px] font-semibold tabular-nums text-white">{activeCount}</span>
            )}
          </button>
          <AnimatePresence>
            {panelOpen && (
              <motion.div
                role="dialog"
                aria-label="Filters"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
                transition={{ duration: 0.14 }}
                className="absolute left-0 z-30 mt-2 w-[min(92vw,460px)] origin-top-left rounded-2xl border border-slate-200/80 bg-white p-4 shadow-pop dark:border-white/10 dark:bg-ink-800"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {showStatus && (
                    <Field label="Status">
                      <Select value={filters.status} onChange={(e) => setFilters({ status: e.target.value as TaskFilters['status'] })} aria-label="Filter by status">
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field label="Priority">
                    <Select value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value as TaskFilters['priority'] })} aria-label="Filter by priority">
                      <option value="all">All priorities</option>
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_META[p].label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Due">
                    <Select value={filters.due} onChange={(e) => setFilters({ due: e.target.value as TaskFilters['due'] })} aria-label="Filter by due date">
                      {DUE_FILTER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Project">
                    <Select value={filters.projectId} onChange={(e) => setFilters({ projectId: e.target.value })} aria-label="Filter by project">
                      <option value="all">All projects</option>
                      <option value="none">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Category">
                    <Select value={filters.category} onChange={(e) => setFilters({ category: e.target.value })} aria-label="Filter by category">
                      <option value="all">All categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tag">
                    <Select value={filters.tag} onChange={(e) => setFilters({ tag: e.target.value })} aria-label="Filter by tag">
                      <option value="all">All tags</option>
                      {tags.map((t) => (
                        <option key={t} value={t}>
                          #{t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/[0.06]">
                  <button
                    className="btn-ghost btn-sm"
                    disabled={activeCount === 0}
                    onClick={() => setFilters({ ...DEFAULT_FILTERS, search: filters.search, ...(showStatus ? {} : { status: filters.status }) })}
                  >
                    Reset filters
                  </button>
                  <button className="btn-primary btn-sm" onClick={closePanel}>
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showSort && (
          <div className="flex items-center gap-1">
            <Select
              aria-label="Sort tasks by"
              value={sort.key}
              onChange={(e) => setSort({ ...sort, key: e.target.value as typeof sort.key })}
              className="w-[158px]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  Sort: {o.label}
                </option>
              ))}
            </Select>
            <button
              onClick={() => setSort({ ...sort, reversed: !sort.reversed })}
              className={cn('btn-icon border border-slate-200 dark:border-white/10', sort.reversed && 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300')}
              aria-pressed={sort.reversed}
              aria-label="Reverse sort order"
              title="Reverse order"
            >
              <ArrowDownUp className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {(chips.length > 0 || filters.search) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap items-center gap-1.5 overflow-hidden"
          >
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-violet-50 pl-2.5 pr-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/20"
              >
                {chip.label}
                <button
                  onClick={() => setFilters({ [chip.key]: DEFAULT_FILTERS[chip.key] } as Partial<TaskFilters>)}
                  aria-label={`Remove filter ${chip.label}`}
                  className="rounded p-0.5 hover:bg-violet-100 dark:hover:bg-violet-500/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button onClick={resetFilters} className="h-7 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5 dark:hover:text-slate-200">
              Clear all
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function ViewSwitcher() {
  const { route } = useUIState();
  const { navigate } = useUIActions();
  const current = route.name === 'board' ? 'board' : route.name === 'calendar' ? 'calendar' : 'tasks';
  return (
    <Segmented
      label="Task view"
      value={current}
      onChange={(v) => navigate({ name: v })}
      options={[
        { value: 'tasks', label: <><List className="h-4 w-4" /> <span className="hidden sm:inline">List</span></>, title: 'List view' },
        { value: 'board', label: <><Columns3 className="h-4 w-4" /> <span className="hidden sm:inline">Board</span></>, title: 'Board view' },
        { value: 'calendar', label: <><CalendarRange className="h-4 w-4" /> <span className="hidden sm:inline">Calendar</span></>, title: 'Calendar view' },
      ]}
    />
  );
}
