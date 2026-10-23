import DeleteOutline from '@mui/icons-material/DeleteOutline'
import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { CreateAction } from '../components/CreateAction'
import { EmptyState, ErrorState, LoadingState } from '../components/States'

interface Notice {
  id: string
  message: string
  enabled: boolean
  audience: 'organization' | 'users' | 'organizations'
  target_ids: string[]
}
interface Option { id: string; name?: string; full_name?: string }
interface NoticePayload { items: Notice[]; users: Array<{ id: string; full_name: string }>; organizations: Array<{ id: string; name: string }> }

const emptyForm = { message: '', enabled: true, audience: 'organization' as Notice['audience'], target_ids: [] as string[] }

export function AppNoticesPage() {
  const { t } = useTranslation()
  const { user, can, refreshUser } = useAuth()
  const qc = useQueryClient()
  const editable = can('app.install.manage') || can('settings.manage')
  const [navbar, setNavbar] = useState(user?.install_prompt?.navbar ?? true)
  useEffect(() => {
    setNavbar(user?.install_prompt?.navbar ?? true)
  }, [user?.install_prompt?.navbar])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const data = useQuery({
    queryKey: ['app-notices'],
    queryFn: async () => (await api.get<NoticePayload>('/workspace/app-notices')).data,
  })
  const saveNavbar = useMutation({
    mutationFn: () => api.patch('/workspace/install-prompt', { navbar, notice: true, message: '' }),
    onSuccess: refreshUser,
  })
  const create = useMutation({
    mutationFn: () => api.post('/workspace/app-notices', form),
    onSuccess: () => {
      setOpen(false)
      setForm(emptyForm)
      void qc.invalidateQueries({ queryKey: ['app-notices'] })
    },
  })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Notice> }) => api.patch(`/workspace/app-notices/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-notices'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/app-notices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-notices'] }),
  })
  const users = data.data?.users ?? []
  const organizations = data.data?.organizations ?? []
  const items = data.data?.items ?? []
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6">{t('install.noticesTitle')}</Typography>
          <Typography color="text.secondary">{t('install.noticesHelp')}</Typography>
        </Box>
        {editable && <CreateAction label={t('install.addNotice')} onClick={() => { setForm(emptyForm); setOpen(true) }} />}
      </Box>
      <Card>
        <CardContent>
          <FormControlLabel
            control={<Switch checked={navbar} disabled={!editable} onChange={(_, checked) => setNavbar(checked)} />}
            label={t('install.showNavbar')}
          />
          {editable && <Button variant="contained" size="small" sx={{ ml: 1 }} disabled={saveNavbar.isPending} onClick={() => saveNavbar.mutate()}>{t('common.save')}</Button>}
        </CardContent>
      </Card>
      {data.isLoading ? <LoadingState /> : data.isError ? <ErrorState /> : !items.length ? <EmptyState title={t('install.noNotices')} description={t('install.noNoticesHelp')} /> : items.map((notice) => (
        <NoticeCard
          key={notice.id}
          notice={notice}
          editable={editable}
          users={users}
          organizations={organizations}
          platform={Boolean(user?.is_platform_admin)}
          onSave={(body) => update.mutate({ id: notice.id, body })}
          onDelete={() => remove.mutate(notice.id)}
        />
      ))}
      {(create.isError || update.isError || remove.isError || saveNavbar.isError) && <Alert severity="error">{t('common.saveError')}</Alert>}
      {(create.isSuccess || update.isSuccess || saveNavbar.isSuccess) && <Alert severity="success">{t('settings.admin.saved')}</Alert>}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('install.addNotice')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
          <NoticeFields form={form} setForm={setForm} users={users} organizations={organizations} platform={Boolean(user?.is_platform_admin)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={create.isPending} onClick={() => create.mutate()}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function NoticeCard({
  notice,
  editable,
  users,
  organizations,
  platform,
  onSave,
  onDelete,
}: {
  notice: Notice
  editable: boolean
  users: Array<{ id: string; full_name: string }>
  organizations: Array<{ id: string; name: string }>
  platform: boolean
  onSave: (body: Partial<Notice>) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ message: notice.message, enabled: notice.enabled, audience: notice.audience, target_ids: notice.target_ids })
  useEffect(() => {
    setForm({ message: notice.message, enabled: notice.enabled, audience: notice.audience, target_ids: notice.target_ids })
  }, [notice.id, notice.message, notice.enabled, notice.audience, notice.target_ids])
  return (
    <Card>
      <CardContent sx={{ display: 'grid', gap: 2 }}>
        <NoticeFields form={form} setForm={setForm} users={users} organizations={organizations} platform={platform} disabled={!editable} />
        {editable && (
          <Stack direction="row" gap={1}>
            <Button variant="contained" onClick={() => onSave(form)}>{t('common.save')}</Button>
            <Button color="error" startIcon={<DeleteOutline />} onClick={onDelete}>{t('common.delete')}</Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function NoticeFields({
  form,
  setForm,
  users,
  organizations,
  platform,
  disabled = false,
}: {
  form: typeof emptyForm
  setForm: (next: typeof emptyForm) => void
  users: Array<{ id: string; full_name: string }>
  organizations: Array<{ id: string; name: string }>
  platform: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const userOptions: Option[] = users.map((person) => ({ id: person.id, full_name: person.full_name }))
  const orgOptions: Option[] = organizations.map((org) => ({ id: org.id, name: org.name }))
  const selectedUsers = userOptions.filter((item) => form.target_ids.includes(item.id))
  const selectedOrgs = orgOptions.filter((item) => form.target_ids.includes(item.id))
  return (
    <>
      <FormControlLabel control={<Switch checked={form.enabled} disabled={disabled} onChange={(_, checked) => setForm({ ...form, enabled: checked })} />} label={t('install.noticeEnabled')} />
      <TextField
        label={t('install.noticeMessage')}
        value={form.message}
        disabled={disabled}
        onChange={(event) => setForm({ ...form, message: event.target.value.slice(0, 400) })}
        helperText={t('install.noticeMessageHelp')}
        multiline
        minRows={2}
      />
      <FormControl fullWidth disabled={disabled}>
        <InputLabel>{t('install.audience')}</InputLabel>
        <Select
          label={t('install.audience')}
          value={form.audience}
          onChange={(event) => setForm({ ...form, audience: event.target.value as Notice['audience'], target_ids: [] })}
        >
          <MenuItem value="organization">{t('install.audienceOrganization')}</MenuItem>
          <MenuItem value="users">{t('install.audienceUsers')}</MenuItem>
          {platform && <MenuItem value="organizations">{t('install.audienceOrganizations')}</MenuItem>}
        </Select>
      </FormControl>
      {form.audience === 'users' && (
        <Autocomplete
          multiple
          disabled={disabled}
          options={userOptions}
          value={selectedUsers}
          getOptionLabel={(option) => option.full_name ?? option.id}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_, value) => setForm({ ...form, target_ids: value.map((item) => item.id) })}
          renderTags={(value, getTagProps) => value.map((option, index) => <Chip {...getTagProps({ index })} key={option.id} label={option.full_name} />)}
          renderInput={(params) => <TextField {...params} label={t('install.chooseUsers')} />}
        />
      )}
      {form.audience === 'organizations' && (
        <Autocomplete
          multiple
          disabled={disabled}
          options={orgOptions}
          value={selectedOrgs}
          getOptionLabel={(option) => option.name ?? option.id}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_, value) => setForm({ ...form, target_ids: value.map((item) => item.id) })}
          renderTags={(value, getTagProps) => value.map((option, index) => <Chip {...getTagProps({ index })} key={option.id} label={option.name} />)}
          renderInput={(params) => <TextField {...params} label={t('install.chooseOrganizations')} />}
        />
      )}
    </>
  )
}
