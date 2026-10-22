// @ts-nocheck
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { currentWeekSeries, productivityTrend } from '../../lib/stats';
import { ChartTooltip, axisProps, chartTheme } from '../ui/ChartKit';

// Loaded on demand so the dashboard renders before the charting library arrives.

export default function WeekBars({ data, isDark }: { data: ReturnType<typeof currentWeekSeries>; isDark: boolean }) {
  const theme = chartTheme(isDark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(isDark)} />
        <YAxis allowDecimals={false} width={24} {...axisProps(isDark)} />
        <Tooltip cursor={{ fill: theme.cursor, radius: 6 }} content={<ChartTooltip labelKey="fullLabel" />} />
        <Bar dataKey="completed" name="Completed" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.label} fill={theme.primary} fillOpacity={d.isToday ? 1 : d.isFuture ? 0.2 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendArea({ data, isDark }: { data: ReturnType<typeof productivityTrend>['series']; isDark: boolean }) {
  const theme = chartTheme(isDark);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.primary} stopOpacity={0.22} />
            <stop offset="100%" stopColor={theme.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="label" {...axisProps(isDark)} interval="preserveStartEnd" minTickGap={28} />
        <YAxis allowDecimals={false} width={24} {...axisProps(isDark)} />
        <Tooltip cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }} content={<ChartTooltip labelKey="fullLabel" />} />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke={theme.primary}
          strokeWidth={2}
          fill="url(#trendFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
