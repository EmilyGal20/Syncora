// @ts-nocheck
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16')}>
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-violet-400/10 blur-xl dark:bg-violet-500/10" />
        <div
          className={cn(
            'relative grid place-items-center rounded-2xl bg-gradient-to-br from-violet-50 to-white text-violet-500 ring-1 ring-violet-100 dark:from-violet-500/15 dark:to-transparent dark:text-violet-300 dark:ring-violet-400/15',
            compact ? 'h-11 w-11' : 'h-14 w-14',
          )}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
