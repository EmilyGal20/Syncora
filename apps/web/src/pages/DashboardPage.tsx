import Download from '@mui/icons-material/Download'
import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { EngineDashboardSection } from '../components/EngineOverview'
import { ErrorState, LoadingState } from '../components/States'
import { PageHeader } from '../components/PageHeader'
import { greetingPeriod } from '../lib/greeting'
import { usePreferences } from '../preferences/WorkspaceProvider'
import type { Dashboard } from '../types'

interface Summary {
  open_tasks: number
  completed_tasks: number
  upcoming_events: Array<{ id: string; title: string; starts_at: string }>
  announcements: Array<{ id: string; title: string; body: string }>
  pinned_notes: Array<{ id: string; title: string; updated_at: string }>
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { can, user } = useAuth()
  const { preferences } = usePreferences()
  const greeting = useMemo(() => {
    const period = t(`dashboard.greetings.${greetingPeriod(new Date(), preferences?.timezone)}`)
    const name = (user?.first_name || user?.full_name || '').trim()
    return name ? t('dashboard.greetingNamed', { greeting: period, name }) : period
  }, [t, preferences?.timezone, user?.first_name, user?.full_name])
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [dashboard, summary] = await Promise.all([api.get<Dashboard>('/dashboards/default'), api.get<Summary>('/dashboard/summary')])
      return { dashboard: dashboard.data, summary: summary.data }
    },
  })

  async function exportDashboard(format: 'pdf' | 'xlsx') {
    const response = await api.get(`/dashboards/default/export.${format}`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `dashboard.${format}`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (q.isLoading) return <LoadingState />
  if (q.isError) return <ErrorState retry={() => void q.refetch()} />

  const s = q.data!.summary
  const total = s.open_tasks + s.completed_tasks
  const completed = total ? Math.round((s.completed_tasks / total) * 100) : 0
  const actions = (
    <Stack direction="row" gap={1}>
      {can('dashboards.export_pdf') && (
        <Button size="small" startIcon={<Download />} onClick={() => void exportDashboard('pdf')}>
          PDF
        </Button>
      )}
      {can('dashboards.export_excel') && (
        <Button size="small" startIcon={<Download />} onClick={() => void exportDashboard('xlsx')}>
          Excel
        </Button>
      )}
    </Stack>
  )

  return (
    <>
      <PageHeader title={greeting} subtitle={t('dashboard.subtitle')} action={actions} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(12, 1fr)' }, gap: 2 }}>
        {q.data?.dashboard.widgets.map(w => (
          <Card key={w.id} sx={{ gridColumn: { xs: 'span 1', lg: `span ${Math.min(12, w.width)}` }, minHeight: w.type === 'kpi' ? 150 : 220 }}>
            <CardContent>
              {w.type === 'kpi' ? (
                <>
                  <Typography color="text.secondary" variant="body2">
                    {w.title}
                  </Typography>
                  <Typography sx={{ fontSize: 40, fontWeight: 750, my: 1 }}>{s.open_tasks}</Typography>
                  <Chip size="small" label="Open tasks" variant="outlined" />
                </>
              ) : (
                <>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {w.title}
                  </Typography>
                  {w.type === 'task_summary' && (
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Completed</Typography>
                        <Typography variant="body2">{completed}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={completed} sx={{ mt: 0.75, height: 7, borderRadius: 1 }} />
                    </Box>
                  )}
                  {w.type === 'announcements' &&
                    (s.announcements[0] ? (
                      <>
                        <Typography fontWeight={650}>{s.announcements[0].title}</Typography>
                        <Typography color="text.secondary">{s.announcements[0].body}</Typography>
                      </>
                    ) : (
                      <Typography color="text.secondary">No announcements for you.</Typography>
                    ))}
                  {w.type === 'schedule' &&
                    (s.upcoming_events[0] ? (
                      <>
                        <Typography sx={{ fontWeight: 650 }}>{s.upcoming_events[0].title}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {new Date(s.upcoming_events[0].starts_at).toLocaleString()}
                        </Typography>
                      </>
                    ) : (
                      <Typography color="text.secondary">No upcoming events.</Typography>
                    ))}
                  {w.type === 'pinned_notes' &&
                    (s.pinned_notes.length ? (
                      <Stack spacing={1}>
                        {s.pinned_notes.map(note => (
                          <Box key={note.id}>
                            <Typography fontWeight={650}>{note.title}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(note.updated_at).toLocaleString()}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      <Typography color="text.secondary">No pinned notes.</Typography>
                    ))}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
      <EngineDashboardSection />
    </>
  )
}
