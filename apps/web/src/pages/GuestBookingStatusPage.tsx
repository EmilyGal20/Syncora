import ArrowBack from '@mui/icons-material/ArrowBack'
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { SyncoraLogo } from '../components/SyncoraBrand'

interface GuestBooking {
  guest_name: string
  guest_organization: string
  reason: string
  notes: string
  starts_at: string
  ends_at: string
  status: string
  rejection_reason: string
  messages: { at: string; kind: string; body: string }[]
  host_name: string
  workspace_name: string
}

export function GuestBookingStatusPage() {
  const { token = '' } = useParams()
  const { t, i18n } = useTranslation()
  const justSubmitted = Boolean((useLocation().state as { justSubmitted?: boolean } | null)?.justSubmitted)
  const query = useQuery({
    queryKey: ['guest-booking', token],
    queryFn: async () => (await api.get<GuestBooking>(`/public/bookings/${token}`)).data,
    refetchInterval: 12_000,
    retry: false,
  })
  const booking = query.data
  const formatRange = (start: string, end: string) => {
    const from = new Date(start)
    const to = new Date(end)
    return `${new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeStyle: 'short' }).format(from)} – ${new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(to)}`
  }
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Button component={Link} to="/login" startIcon={<ArrowBack />}>{t('auth.signIn')}</Button>
          <SyncoraLogo compact asset="wordmark" />
        </Box>
        {justSubmitted && <Alert severity="success" sx={{ mb: 2 }}>{t('booking.submitted')}</Alert>}
        {query.isError ? <Alert severity="error">{t('booking.missingRequest')}</Alert> : booking && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
              <Box>
                <Typography variant="h5">{booking.workspace_name}</Typography>
                <Typography color="text.secondary">{t('booking.withHost', { host: booking.host_name })}</Typography>
              </Box>
              <Chip label={t(`booking.statuses.${booking.status}`)} color={booking.status === 'approved' ? 'success' : booking.status === 'rejected' ? 'error' : 'warning'} />
            </Stack>
            <Stack spacing={1.5} sx={{ mt: 3 }}>
              <Typography>{formatRange(booking.starts_at, booking.ends_at)}</Typography>
              <Typography>{t('booking.guestName')}: {booking.guest_name}{booking.guest_organization ? ` · ${booking.guest_organization}` : ''}</Typography>
              <Typography>{t('booking.reason')}: {booking.reason}</Typography>
              {booking.notes && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{booking.notes}</Typography>}
              {booking.status === 'rejected' && <Alert severity="error">{booking.rejection_reason || t('booking.noReason')}</Alert>}
              {booking.status === 'pending' && <Alert severity="info">{t('booking.pendingHelp')}</Alert>}
            </Stack>
            {!!booking.messages.length && (
              <Stack spacing={1.25} sx={{ mt: 3 }}>
                <Typography fontWeight={700}>{t('booking.updates')}</Typography>
                {booking.messages.map((message, index) => (
                  <Box key={`${message.at}-${index}`} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.at))}</Typography>
                    <Typography>{message.body}</Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  )
}
