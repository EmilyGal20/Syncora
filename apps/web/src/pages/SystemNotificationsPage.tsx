import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'

const TYPES = [
  ['task.assigned', 'taskAssigned'],
  ['booking.created', 'bookingCreated'],
  ['booking.approved', 'bookingApproved'],
  ['booking.rejected', 'bookingRejected'],
  ['support.reply', 'supportReply'],
  ['support.created', 'supportCreated'],
  ['dashboard.assigned', 'dashboardAssigned'],
  ['registration.submitted', 'registrationSubmitted'],
] as const

interface Named { id: string; name?: string; full_name?: string }
interface Policy {
  types: Record<string, boolean>
  audience: 'organization' | 'roles' | 'users'
  target_ids: string[]
  roles?: Named[]
  users?: Named[]
}

export function SystemNotificationsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['system-notifications', 'manage'], queryFn: async () => (await api.get<Policy>('/system-notifications')).data })
  const [form, setForm] = useState<Policy | null>(null)
  useEffect(() => {
    if (query.data) setForm({ types: query.data.types, audience: query.data.audience, target_ids: query.data.target_ids, roles: query.data.roles, users: query.data.users })
  }, [query.data])
  const save = useMutation({
    mutationFn: () => api.patch('/system-notifications', { types: form?.types, audience: form?.audience, target_ids: form?.audience === 'organization' ? [] : form?.target_ids }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['system-notifications'] }) },
  })
  if (!form) return null
  const roles = query.data?.roles ?? []
  const users = query.data?.users ?? []
  const selectedRoles = roles.filter((role) => form.target_ids.includes(role.id))
  const selectedUsers = users.filter((person) => form.target_ids.includes(person.id))
  return (
    <Card>
      <CardContent sx={{ display: 'grid', gap: 2, maxWidth: 720 }}>
        <Box>
          <Typography variant="h6">{t('systemNotifications.title')}</Typography>
          <Typography color="text.secondary">{t('systemNotifications.help')}</Typography>
        </Box>
        <Typography fontWeight={700}>{t('systemNotifications.types')}</Typography>
        {TYPES.map(([code, key]) => (
          <FormControlLabel
            key={code}
            control={<Switch checked={form.types[code] !== false} onChange={(_, checked) => setForm({ ...form, types: { ...form.types, [code]: checked } })} />}
            label={t(`systemNotifications.typesMap.${key}`)}
          />
        ))}
        <FormControl fullWidth>
          <InputLabel>{t('systemNotifications.audience')}</InputLabel>
          <Select
            label={t('systemNotifications.audience')}
            value={form.audience}
            onChange={(event) => setForm({ ...form, audience: event.target.value as Policy['audience'], target_ids: [] })}
          >
            <MenuItem value="organization">{t('systemNotifications.audienceOrganization')}</MenuItem>
            <MenuItem value="roles">{t('systemNotifications.audienceRoles')}</MenuItem>
            <MenuItem value="users">{t('systemNotifications.audienceUsers')}</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">{t('systemNotifications.audienceHelp')}</Typography>
        {form.audience === 'roles' && (
          <Autocomplete
            multiple
            options={roles}
            value={selectedRoles}
            getOptionLabel={(option) => option.name ?? option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => setForm({ ...form, target_ids: value.map((item) => item.id) })}
            renderTags={(value, getTagProps) => value.map((option, index) => <Chip {...getTagProps({ index })} key={option.id} label={option.name} />)}
            renderInput={(params) => <TextField {...params} label={t('systemNotifications.chooseRoles')} />}
          />
        )}
        {form.audience === 'users' && (
          <Autocomplete
            multiple
            options={users}
            value={selectedUsers}
            getOptionLabel={(option) => option.full_name ?? option.id}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => setForm({ ...form, target_ids: value.map((item) => item.id) })}
            renderTags={(value, getTagProps) => value.map((option, index) => <Chip {...getTagProps({ index })} key={option.id} label={option.full_name} />)}
            renderInput={(params) => <TextField {...params} label={t('systemNotifications.chooseUsers')} />}
          />
        )}
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} sx={{ justifySelf: 'start' }}>{t('common.save')}</Button>
        {save.isSuccess && <Alert severity="success">{t('settings.admin.saved')}</Alert>}
        {save.isError && <Alert severity="error">{t('common.saveError')}</Alert>}
      </CardContent>
    </Card>
  )
}
