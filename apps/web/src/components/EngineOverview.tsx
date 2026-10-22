import Add from '@mui/icons-material/Add'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline'
import TrendingDown from '@mui/icons-material/TrendingDown'
import TrendingUp from '@mui/icons-material/TrendingUp'
import WarningAmber from '@mui/icons-material/WarningAmber'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useAuth } from '../auth/AuthProvider'
import { addDays, diffInDays, formatDueLabel, parseISODate, relativeTime, toISODate } from '../taskflow/lib/date'
import { currentWeekSeries, getOverview, productivityTrend, projectStats, weekComparison } from '../taskflow/lib/stats'
import { PRIORITY_META, dueDateTime, isDueOn, isOverdue, sortTasks } from '../taskflow/lib/tasks'
import { DataProvider, useData } from '../taskflow/store/DataContext'
import type { Task as EngineTask } from '../taskflow/types'

const PRIORITY_LIMIT = 6

export function EngineDashboardSection() {
  const { user } = useAuth()
  return (
    <DataProvider workspaceId={user?.organization_id}>
      <EngineOverview />
    </DataProvider>
  )
}

function EngineOverview() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const theme = useTheme()
  const now = useMemo(() => new Date(), [])
  const { tasks, projects, activity, settings, createTask, bulkUpdate, toggleComplete } = useData()

  const overview = useMemo(() => getOverview(tasks, now, settings.dailyGoal), [tasks, now, settings.dailyGoal])
  const week = useMemo(() => currentWeekSeries(tasks, now, settings.weekStartsOn), [tasks, now, settings.weekStartsOn])
  const weekVs = useMemo(() => weekComparison(tasks, now, settings.weekStartsOn), [tasks, now, settings.weekStartsOn])
  const trend = useMemo(() => productivityTrend(tasks, now, 14), [tasks, now])
  const overdue = useMemo(() => sortTasks(tasks.filter((task: EngineTask) => isOverdue(task, now)), { key: 'priority', reversed: false }), [tasks, now])
  const dueTodayOpen = useMemo(
    () => tasks.filter((task: EngineTask) => task.status !== 'done' && isDueOn(task, now) && !isOverdue(task, now)),
    [tasks, now],
  )
  const priorities = useMemo(
    () => sortTasks([...overdue, ...dueTodayOpen], { key: 'priority', reversed: false }),
    [overdue, dueTodayOpen],
  )
  const completedToday = useMemo(
    () => tasks.filter((task: EngineTask) => task.completedAt && diffInDays(new Date(task.completedAt), now) === 0),
    [tasks, now],
  )
  const upcoming = useMemo(() => {
    const horizon = addDays(now, 7)
    return sortTasks(
      tasks.filter((task: EngineTask) => {
        const due = dueDateTime(task)
        return task.status !== 'done' && due !== null && !isDueOn(task, now) && due > now && due <= horizon
      }),
      { key: 'dueDate', reversed: false },
    ).slice(0, 5)
  }, [tasks, now])

  const openCount = overview.total - overview.completed
  const chartColor = theme.palette.primary.main
  const trendColor = trend.change >= 0 ? theme.palette.success.main : theme.palette.error.main

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }} alignItems={{ md: 'flex-end' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">{t('dashboard.engine.section')}</Typography>
          <Typography variant="h5">{t('dashboard.engine.title')}</Typography>
          <Typography color="text.secondary">
            {priorities.length === 0
              ? t('dashboard.engine.clearDay')
              : t('dashboard.engine.prioritySummary', { count: priorities.length, overdue: overdue.length, done: completedToday.length })}
          </Typography>
        </Box>
        <QuickAdd createTask={createTask} now={now} />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        <Stat label={t('dashboard.engine.completedToday')} value={`${overview.completedToday} / ${settings.dailyGoal}`} hint={<LinearProgress variant="determinate" value={overview.goalProgress} sx={{ mt: 1, height: 7, borderRadius: 1 }} />} />
        <Stat label={t('dashboard.engine.dueToday')} value={dueTodayOpen.length} hint={t('dashboard.engine.openTotal', { count: openCount })} onClick={() => navigate('/flow/tasks')} />
        <Stat label={t('dashboard.engine.overdue')} value={overdue.length} hint={overdue.length ? t('dashboard.engine.needsAttention') : t('dashboard.engine.caughtUp')} onClick={() => navigate('/flow/tasks')} />
        <Stat
          label={t('dashboard.engine.weekDone')}
          value={weekVs.thisWeek}
          hint={
            <Stack direction="row" alignItems="center" gap={0.5} color={weekVs.change >= 0 ? 'success.main' : 'error.main'}>
              {weekVs.change >= 0 ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
              <Typography variant="body2">{weekVs.change >= 0 ? '+' : ''}{weekVs.change}% {t('dashboard.engine.vsLastWeek')}</Typography>
            </Stack>
          }
          onClick={() => navigate('/flow/analytics')}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '2fr 1fr' }, gap: 2 }}>
        <Stack gap={2}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6">{t('dashboard.engine.priorities')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('dashboard.engine.prioritiesHelp')}</Typography>
                </Box>
                {priorities.length > PRIORITY_LIMIT && <Button size="small" onClick={() => navigate('/flow/tasks')}>{t('dashboard.engine.viewAll')}</Button>}
              </Stack>
              {priorities.length === 0 ? (
                <Typography color="text.secondary">{t('dashboard.engine.noPriorities')}</Typography>
              ) : (
                <List disablePadding>
                  {priorities.slice(0, PRIORITY_LIMIT).map((task: EngineTask) => (
                    <ListItemButton key={task.id} onClick={() => navigate('/flow/tasks')} sx={{ px: 0.5, borderRadius: 1 }}>
                      <Checkbox
                        checked={task.status === 'done'}
                        onClick={event => event.stopPropagation()}
                        onChange={() => toggleComplete(task.id)}
                        size="small"
                      />
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_META[task.priority].color, mr: 1.5, flexShrink: 0 }} />
                      <ListItemText
                        primary={task.title}
                        secondary={task.dueDate ? formatDueLabel(task.dueDate, task.dueTime, now) : projects.find((project: { id: string }) => project.id === task.projectId)?.name}
                        primaryTypographyProps={{ noWrap: true, fontWeight: 650 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
              {completedToday.length > 0 && (
                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <CheckCircleOutline color="success" fontSize="small" />
                  <Typography variant="body2" fontWeight={650}>{t('dashboard.engine.doneToday')}</Typography>
                  {completedToday.slice(0, 4).map((task: EngineTask) => (
                    <Chip key={task.id} size="small" label={task.title} onClick={() => navigate('/flow/tasks')} sx={{ textDecoration: 'line-through' }} />
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Card>
              <CardContent>
                <Typography variant="h6">{t('dashboard.engine.thisWeek')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('dashboard.engine.weekHint', { done: weekVs.thisWeek, due: week.reduce((sum: number, day: { due: number }) => sum + day.due, 0) })}</Typography>
                <Box sx={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={week}>
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="completed" fill={chartColor} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">{t('dashboard.engine.trend')}</Typography>
                    <Typography variant="body2" color="text.secondary">{t('dashboard.engine.trendHint', { count: trend.recent })}</Typography>
                  </Box>
                  <Chip size="small" color={trend.change >= 0 ? 'success' : 'error'} label={`${trend.change >= 0 ? '+' : ''}${trend.change}%`} />
                </Stack>
                <Box sx={{ height: 180, mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend.series}>
                      <XAxis dataKey="label" hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="completed" stroke={trendColor} fill={trendColor} fillOpacity={0.16} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {projects.length > 0 && (
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h6">{t('dashboard.engine.projects')}</Typography>
                  <Button size="small" onClick={() => navigate('/flow/projects')}>{t('dashboard.engine.viewAll')}</Button>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {projects.slice(0, 6).map((project: { id: string; name: string; color: string }) => {
                    const stats = projectStats(project.id, tasks, now)
                    return (
                      <Box key={project.id} onClick={() => navigate(`/flow/projects/${project.id}`)} sx={{ cursor: 'pointer' }}>
                        <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: 0.75 }}>
                          <Stack direction="row" gap={1} alignItems="center" minWidth={0}>
                            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: project.color, flexShrink: 0 }} />
                            <Typography noWrap fontWeight={650}>{project.name}</Typography>
                          </Stack>
                          <Typography variant="body2" color="text.secondary">{stats.completed}/{stats.total} · {stats.progress}%</Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={stats.progress} sx={{ height: 7, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: project.color } }} />
                      </Box>
                    )
                  })}
                </Box>
              </CardContent>
            </Card>
          )}
        </Stack>

        <Stack gap={2}>
          <Card>
            <CardContent>
              <Typography variant="h6">{t('dashboard.engine.focus')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('dashboard.engine.focusHelp')}</Typography>
              <Stack direction="row" gap={2} alignItems="center">
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={overview.productivity} size={96} thickness={4} />
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <Typography fontWeight={750}>{overview.productivity}%</Typography>
                  </Box>
                </Box>
                <Stack spacing={1} flex={1}>
                  <Metric label={t('dashboard.engine.todayTasks')} value={`${overview.todayDone}/${overview.todayTotal}`} />
                  <Metric label={t('dashboard.engine.dailyGoal')} value={`${overview.completedToday}/${settings.dailyGoal}`} />
                  <Metric label={t('dashboard.engine.inProgress')} value={overview.inProgress} />
                  <Metric label={t('dashboard.engine.completionRate')} value={`${overview.completionRate}%`} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {overdue.length > 0 && (
            <Card sx={{ borderColor: 'error.light' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="h6">{t('dashboard.engine.overdue')}</Typography>
                    <Typography variant="body2" color="error">{t('dashboard.engine.overdueCount', { count: overdue.length })}</Typography>
                  </Box>
                  <Button size="small" startIcon={<WarningAmber />} onClick={() => bulkUpdate(overdue.map((task: EngineTask) => task.id), { dueDate: toISODate(now), dueTime: null })}>
                    {t('dashboard.engine.moveToday')}
                  </Button>
                </Stack>
                {overdue.slice(0, 4).map((task: EngineTask) => (
                  <ListItemButton key={task.id} onClick={() => navigate('/flow/tasks')} sx={{ px: 0.5, borderRadius: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PRIORITY_META[task.priority].color, mr: 1.5 }} />
                    <ListItemText primary={task.title} secondary={formatDueLabel(task.dueDate!, task.dueTime, now)} primaryTypographyProps={{ noWrap: true }} />
                  </ListItemButton>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="h6">{t('dashboard.engine.upcoming')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('dashboard.engine.nextDays')}</Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/flow/calendar')}>{t('engine.calendar')}</Button>
              </Stack>
              {upcoming.length === 0 ? (
                <Typography color="text.secondary">{t('dashboard.engine.noUpcoming')}</Typography>
              ) : upcoming.map((task: EngineTask) => {
                const due = parseISODate(task.dueDate!)
                const days = diffInDays(due, now)
                return (
                  <ListItemButton key={task.id} onClick={() => navigate('/flow/calendar')} sx={{ px: 0.5, borderRadius: 1 }}>
                    <Box sx={{ width: 42, mr: 1.5, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">{due.toLocaleDateString(undefined, { month: 'short' })}</Typography>
                      <Typography fontWeight={750}>{due.getDate()}</Typography>
                    </Box>
                    <ListItemText primary={task.title} secondary={formatDueLabel(task.dueDate!, task.dueTime, now)} primaryTypographyProps={{ noWrap: true }} />
                    <Typography variant="caption" color={days <= 1 ? 'warning.main' : 'text.secondary'}>
                      {days === 1 ? t('dashboard.engine.inOneDay') : t('dashboard.engine.inDays', { count: days })}
                    </Typography>
                  </ListItemButton>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t('dashboard.engine.activity')}</Typography>
              {activity.length === 0 ? (
                <Typography color="text.secondary">{t('dashboard.engine.noActivity')}</Typography>
              ) : activity.slice(0, 6).map((item: { id: string; message: string; at: string }) => (
                <Box key={item.id} sx={{ mb: 1.25 }}>
                  <Typography variant="body2" noWrap>{item.message}</Typography>
                  <Typography variant="caption" color="text.secondary">{relativeTime(item.at, now)}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  )
}

function Stat({ label, value, hint, onClick }: { label: string; value: string | number; hint?: ReactNode; onClick?: () => void }) {
  return (
    <Card onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <CardContent>
        <Typography color="text.secondary" variant="body2">{label}</Typography>
        <Typography sx={{ fontSize: 32, fontWeight: 750, my: 0.5 }}>{value}</Typography>
        {typeof hint === 'string' ? <Typography variant="body2" color="text.secondary">{hint}</Typography> : hint}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700}>{value}</Typography>
    </Stack>
  )
}

function QuickAdd({ createTask, now }: { createTask: (input: {
  title: string; description: string; status: 'todo'; priority: 'medium'; dueDate: string | null; dueTime: null; projectId: null; category: null; tags: []; subtasks: []; notes: string; recurrence: null
}) => void; now: Date }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [today, setToday] = useState(true)
  const [added, setAdded] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    const clean = title.trim()
    if (!clean) return
    createTask({
      title: clean.slice(0, 200),
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: today ? toISODate(now) : null,
      dueTime: null,
      projectId: null,
      category: null,
      tags: [],
      subtasks: [],
      notes: '',
      recurrence: null,
    })
    setTitle('')
    setAdded(true)
  }

  return (
    <>
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, alignItems: 'center', width: { xs: '100%', md: 420 } }}>
        <TextField size="small" fullWidth value={title} onChange={event => setTitle(event.target.value)} placeholder={t('dashboard.engine.quickAdd')} inputProps={{ maxLength: 200, 'aria-label': t('dashboard.engine.quickAdd') }} />
        <ToggleButton value="today" selected={today} onChange={() => setToday(value => !value)} size="small">{t('schedule.today')}</ToggleButton>
        <Button type="submit" variant="contained" startIcon={<Add />} disabled={!title.trim()}>{t('common.add')}</Button>
      </Box>
      <Snackbar open={added} autoHideDuration={2500} onClose={() => setAdded(false)} message={t('dashboard.engine.added')} />
    </>
  )
}
