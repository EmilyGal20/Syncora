// @ts-nocheck
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';
  hint?: ReactNode;
  onClick?: () => void;
  index?: number;
}

const TONES = {
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
};

export function StatCard({ label, value, icon: Icon, tone, hint, onClick, index = 0 }: StatCardProps) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        'card group flex w-full flex-col p-4 text-left sm:p-5',
        onClick &&
          'transition hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:hover:border-white/[0.12]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 pt-1 text-[13px] font-medium leading-snug text-slate-500 dark:text-slate-400">{label}</span>
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105', TONES[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">{value}</div>
      {hint && <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </Comp>
  );
}
