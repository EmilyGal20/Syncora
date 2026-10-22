import ContentCopy from '@mui/icons-material/ContentCopy'
import LinkOutlined from '@mui/icons-material/LinkOutlined'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addMinutes } from 'date-fns'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { SyncoraDatePicker, SyncoraTimePicker } from './SyncoraDateTime'

export interface BookingLinkItem { id: string; kind: string; slug: string; title: string; enabled: boolean; duration_minutes: number; path: string; url: string; owner_user_id: string | null }
interface BookingRequestItem {
  id: string; guest_name: string; guest_organization: string; guest_email: string | null; guest_phone: string | null
  reason: string; notes: string; starts_at: string; ends_at: string; timezone: string; status: string; rejection_reason: string
}
interface LinksResponse { personal: BookingLinkItem[]; workspace: BookingLinkItem[] }

function publicUrl(item: BookingLinkItem) {
  return `${window.location.origin}${item.path}`
}

export function BookingActions() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const qc = useQueryClient()
  const links = useQuery({ queryKey: ['booking-links'], queryFn: async () => (await api.get<LinksResponse>('/booking-links')).data })
  const [manage, setManage] = useState(false)
  const [kind, setKind] = useState<'meeting' | 'appointment' | null>(null)
  const item = kind ? links.data?.personal.find((link) => link.kind === kind) ?? links.data?.workspace.find((link) => link.kind === kind) : undefined
  return (
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
      <Button size="small" variant="outlined" onClick={() => { void links.refetch(); setKind('meeting') }}>{t('booking.setMeeting')}</Button>
      <Button size="small" variant="outlined" onClick={() => { void links.refetch(); setKind('appointment') }}>{t('booking.setAppointments')}</Button>
      <Button size="small" startIcon={<LinkOutlined />} onClick={() => setManage(true)}>{t('booking.editLinks')}</Button>
      <BookingFormDialog open={!!kind} kind={kind ?? 'meeting'} link={item} onClose={() => setKind(null)} />
      <BookingLinksDialog open={manage} onClose={() => setManage(false)} links={links.data} canEditWorkspace={can('booking.manage') || can('settings.manage')} onSaved={() => void qc.invalidateQueries({ queryKey: ['booking-links'] })} />
    </Stack>
  )
}

function BookingFormDialog({ open, kind, link, onClose }: { open: boolean; kind: 'meeting' | 'appointment'; link?: BookingLinkItem; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [copied, setCopied] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestOrganization, setGuestOrganization] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date())
  const [start, setStart] = useState(new Date())
  useEffect(() => {
    if (!open) return
    setCopied(false)
    setGuestName(''); setGuestOrganization(''); setGuestEmail(''); setGuestPhone(''); setReason(''); setNotes('')
    setDate(new Date()); setStart(new Date())
  }, [open, kind])
  const save = useMutation({
    mutationFn: async () => {
      const starts = new Date(date.getFullYear(), date.getMonth(), date.getDate(), start.getHours(), start.getMinutes())
      const ends = addMinutes(starts, link?.duration_minutes ?? 60)
      return api.post('/bookings', {
        kind, guest_name: guestName, guest_organization: guestOrganization, guest_email: guestEmail || null, guest_phone: guestPhone || null,
        reason, notes, starts_at: starts.toISOString(), ends_at: ends.toISOString(), timezone,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['events'] })
      await qc.invalidateQueries({ queryKey: ['bookings'] })
      onClose()
    },
  })
  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(publicUrl(link))
    setCopied(true)
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{kind === 'appointment' ? t('booking.setAppointments') : t('booking.setMeeting')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('booking.shareHelp')}</Typography>
          <TextField size="small" fullWidth value={link ? publicUrl(link) : ''} InputProps={{ readOnly: true }} />
          <Button sx={{ mt: 1 }} startIcon={<ContentCopy />} onClick={() => void copyLink()}>{t('booking.copyForSend')}</Button>
          {copied && <Typography variant="caption" color="success.main" sx={{ ml: 1 }}>{t('booking.copied')}</Typography>}
        </Paper>
        <Typography variant="body2" color="text.secondary">{t('booking.formHelp')}</Typography>
        <TextField required label={t('booking.guestName')} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
        <TextField label={t('booking.guestOrg')} value={guestOrganization} onChange={(e) => setGuestOrganization(e.target.value)} />
        <TextField type="email" label={t('booking.guestEmail')} value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
        <TextField label={t('booking.guestPhone')} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
        <TextField required label={t('booking.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <TextField multiline minRows={3} label={t('booking.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <SyncoraDatePicker label={t('schedule.date')} value={date} onChange={(value) => value && setDate(value)} />
        <SyncoraTimePicker label={t('schedule.start')} value={start} onChange={(value) => value && setStart(value)} />
        {save.isError && <Alert severity="error">{t('common.saveError')}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={save.isPending || guestName.trim().length < 2 || reason.trim().length < 2} onClick={() => save.mutate()}>{t('booking.saveToSchedule')}</Button>
      </DialogActions>
    </Dialog>
  )
}

function BookingLinksDialog({ open, onClose, links, canEditWorkspace, onSaved }: { open: boolean; onClose: () => void; links?: LinksResponse; canEditWorkspace: boolean; onSaved: () => void }) {
  const { t } = useTranslation()
  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Pick<BookingLinkItem, 'slug' | 'title' | 'enabled'>> }) => api.patch(`/booking-links/${id}`, payload),
    onSuccess: onSaved,
  })
  const groups = [
    { title: t('booking.personalLinks'), items: links?.personal ?? [] },
    { title: t('booking.workspaceLinks'), items: links?.workspace ?? [] },
  ]
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('booking.editLinks')}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        {groups.map((group) => (
          <Box key={group.title}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>{group.title}</Typography>
            <Stack spacing={2}>
              {group.items.map((item) => {
                const locked = item.owner_user_id === null && !canEditWorkspace
                return (
                  <Paper key={item.id} variant="outlined" sx={{ p: 1.5, display: 'grid', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">{item.kind}</Typography>
                    <TextField size="small" label={t('booking.linkTitle')} defaultValue={item.title} disabled={locked} onBlur={(event) => event.target.value !== item.title && save.mutate({ id: item.id, payload: { title: event.target.value } })} />
                    <TextField size="small" label={t('booking.linkSlug')} defaultValue={item.slug} disabled={locked} helperText={publicUrl(item)} onBlur={(event) => event.target.value !== item.slug && save.mutate({ id: item.id, payload: { slug: event.target.value } })} />
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" gap={1}><Switch checked={item.enabled} disabled={locked} onChange={(_, enabled) => save.mutate({ id: item.id, payload: { enabled } })} /><Typography variant="body2">{t('booking.enabled')}</Typography></Stack>
                      <Button size="small" onClick={() => void navigator.clipboard.writeText(publicUrl(item))}>{t('booking.copy')}</Button>
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          </Box>
        ))}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>{t('common.close')}</Button></DialogActions>
    </Dialog>
  )
}

export function BookingInbox() {
  const { t, i18n } = useTranslation()
  const { can } = useAuth()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const highlighted = params.get('booking')
  const [rejecting, setRejecting] = useState<BookingRequestItem | null>(null)
  const [reason, setReason] = useState('')
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: async () => (await api.get<BookingRequestItem[]>('/bookings')).data })
  const pending = bookings.data?.filter((item) => item.status === 'pending') ?? []
  useEffect(() => {
    if (!highlighted) return
    document.getElementById(`booking-${highlighted}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlighted, bookings.data])
  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/bookings/${id}/approve`),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['bookings'] }); await qc.invalidateQueries({ queryKey: ['events'] }); await qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
  const reject = useMutation({
    mutationFn: () => api.post(`/bookings/${rejecting!.id}/reject`, { reason }),
    onSuccess: async () => {
      setRejecting(null); setReason('')
      await qc.invalidateQueries({ queryKey: ['bookings'] })
      await qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  if (!can('schedule.create') && !pending.length) return null
  return (
    <>
      {!!pending.length && <Alert severity="info" sx={{ mb: 2 }}>{t('booking.pendingCount', { count: pending.length })}</Alert>}
      <Stack spacing={1.5} sx={{ mb: pending.length ? 3 : 0 }}>
        {pending.map((item) => (
          <Paper id={`booking-${item.id}`} key={item.id} variant="outlined" sx={{ p: 2, borderColor: highlighted === item.id ? 'primary.main' : 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
              <Box>
                <Typography fontWeight={750}>{item.guest_name}{item.guest_organization ? ` · ${item.guest_organization}` : ''}</Typography>
                <Typography color="text.secondary">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(item.starts_at))} – {new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(new Date(item.ends_at))}</Typography>
                <Typography sx={{ mt: 1 }}>{item.reason}</Typography>
                {item.notes && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{item.notes}</Typography>}
                <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
                  {item.guest_email && <Chip size="small" label={item.guest_email} />}
                  {item.guest_phone && <Chip size="small" label={item.guest_phone} />}
                  <Chip size="small" label={item.timezone} variant="outlined" />
                </Stack>
              </Box>
              <Stack direction="row" gap={1} alignItems="flex-start">
                <Button variant="contained" disabled={approve.isPending} onClick={() => approve.mutate(item.id)}>{t('booking.approve')}</Button>
                <Button color="error" variant="outlined" onClick={() => { setRejecting(item); setReason('') }}>{t('booking.reject')}</Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('booking.rejectTitle')}</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField fullWidth multiline minRows={3} label={t('booking.rejectReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" disabled={reject.isPending} onClick={() => reject.mutate()}>{t('booking.reject')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
