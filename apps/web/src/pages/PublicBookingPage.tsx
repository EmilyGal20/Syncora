import ArrowBack from '@mui/icons-material/ArrowBack'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { addMinutes } from 'date-fns'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { SyncoraLogo } from '../components/SyncoraBrand'
import { SyncoraDatePicker, SyncoraTimePicker } from '../components/SyncoraDateTime'

interface PublicLink { slug: string; kind: string; title: string; duration_minutes: number; workspace_name: string; host_name: string }

export function PublicBookingPage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const link = useQuery({ queryKey: ['public-booking', slug], queryFn: async () => (await api.get<PublicLink>(`/public/booking-links/${slug}`)).data, retry: false })
  const [guestName, setGuestName] = useState('')
  const [guestOrganization, setGuestOrganization] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date())
  const [start, setStart] = useState(new Date())
  const submit = useMutation({
    mutationFn: async () => {
      const starts = new Date(date.getFullYear(), date.getMonth(), date.getDate(), start.getHours(), start.getMinutes())
      const ends = addMinutes(starts, link.data?.duration_minutes ?? 60)
      return (await api.post(`/public/booking-links/${slug}/requests`, {
        guest_name: guestName, guest_organization: guestOrganization, guest_email: guestEmail || null, guest_phone: guestPhone || null,
        reason, notes, starts_at: starts.toISOString(), ends_at: ends.toISOString(), timezone,
      })).data as { guest_token: string; status_url: string }
    },
    onSuccess: (data) => navigate(`/book/status/${data.guest_token}`, { replace: true, state: { justSubmitted: true } }),
  })
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Button component={Link} to="/login" startIcon={<ArrowBack />}>{t('auth.signIn')}</Button>
          <SyncoraLogo compact asset="wordmark" />
        </Box>
        {link.isError ? <Alert severity="error">{t('booking.missingPage')}</Alert> : (
          <>
            <Typography variant="h4" sx={{ mb: 1 }}>{link.data?.title ?? t('booking.loading')}</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>{t('booking.publicHelp', { host: link.data?.host_name ?? '', workspace: link.data?.workspace_name ?? '' })}</Typography>
            <Paper variant="outlined" component="form" onSubmit={(event) => { event.preventDefault(); submit.mutate() }} sx={{ p: { xs: 2, sm: 3 }, display: 'grid', gap: 2 }}>
              <TextField required label={t('booking.guestName')} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              <TextField label={t('booking.guestOrg')} value={guestOrganization} onChange={(e) => setGuestOrganization(e.target.value)} />
              <TextField type="email" label={t('booking.guestEmail')} value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              <TextField label={t('booking.guestPhone')} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} helperText={t('booking.contactHelp')} />
              <TextField required label={t('booking.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              <TextField multiline minRows={3} label={t('booking.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <SyncoraDatePicker label={t('schedule.date')} value={date} onChange={(value) => value && setDate(value)} />
              <SyncoraTimePicker label={t('schedule.start')} value={start} onChange={(value) => value && setStart(value)} />
              <Button type="submit" variant="contained" disabled={submit.isPending || guestName.trim().length < 2 || reason.trim().length < 2 || (!guestEmail && !guestPhone)}>{t('booking.submit')}</Button>
              {submit.isError && <Alert severity="error">{t('booking.submitError')}</Alert>}
            </Paper>
          </>
        )}
      </Box>
    </Box>
  )
}
