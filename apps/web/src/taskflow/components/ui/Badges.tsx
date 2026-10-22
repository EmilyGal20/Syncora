// @ts-nocheck
import { Flag, Hash } from 'lucide-react';
import type { Priority, Project, TaskStatus } from '../../types';
import { PRIORITY_META, STATUS_META } from '../../lib/tasks';
import { cn } from '../../lib/utils';

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold ring-1 ring-inset',
        meta.badge,
        className,
      )}
    >
      <Flag className="h-3 w-3" strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-slate-100 px-2 text-[11.5px] font-medium text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-0.5 rounded-md bg-violet-50 pl-1.5 pr-2 text-[11.5px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
      <Hash className="h-3 w-3 opacity-60" />
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
          className="-mr-1 ml-0.5 rounded px-1 text-violet-400 hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-500/20"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function ProjectLabel({ project, className }: { project: Project; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}
