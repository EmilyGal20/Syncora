// @ts-nocheck
import type { ReactNode } from 'react';

/** Theme-aware colors for Recharts (which takes literal colors, not Tailwind classes). */
export function chartTheme(isDark: boolean) {
  return {
    grid: isDark ? 'rgba(255,255,255,0.06)' : '#eef0f4',
    axis: isDark ? '#7c7c92' : '#94a3b8',
    cursor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.06)',
    surface: isDark ? '#101018' : '#ffffff',
    primary: isDark ? '#a78bfa' : '#7c3aed',
    secondary: isDark ? '#38bdf8' : '#0ea5e9',
  };
}

export const axisProps = (isDark: boolean) => ({
  tickLine: false,
  axisLine: false,
  tick: { fill: chartTheme(isDark).axis, fontSize: 12 },
});

interface TooltipRow {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  labelKey?: string;
  unit?: string;
}

export function ChartTooltip({ active, payload, label, labelKey, unit = '' }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const title = labelKey ? String(payload[0].payload?.[labelKey] ?? label) : label;
  return (
    <div className="min-w-[140px] rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur dark:border-white/10 dark:bg-ink-800/95">
      {title !== undefined && <p className="mb-1.5 font-semibold text-slate-900 dark:text-white">{title}</p>}
      <ul className="space-y-1">
        {payload.map((row) => (
          <li key={String(row.name)} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="flex-1">{row.name}</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
              {String(row.value)}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: i.color }} />
          {i.label}
          {i.value !== undefined && <span className="font-semibold text-slate-900 dark:text-slate-100">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
