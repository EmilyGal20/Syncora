import DeleteOutline from '@mui/icons-material/DeleteOutline'
import UploadFile from '@mui/icons-material/UploadFile'
import { Alert, Box, Button, Card, CardContent, FormControl, InputLabel, List, ListItemButton, ListItemText, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { GrantAuthorityPanel, PagePermissions } from '../components/PagePermissions'
import { PageHeader } from '../components/PageHeader'
import { usePreferences } from '../preferences/WorkspaceProvider'
import { AccessRequestsPanel, AdminSupportPanel, DashboardBuilder, NavigationPanel, Overview, RolesPanel, UsersPanel } from './AdminPage'

export function SettingsPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const admin = can('users.view') || can('roles.manage') || can('settings.manage')
  const panels = useMemo(() => [
    { id: 'permissions', label: t('settings.admin.permissionsTitle'), show: can('roles.manage') || can('users.edit') },
    { id: 'grantors', label: t('settings.admin.grantorsTitle'), show: can('roles.manage') || can('users.edit') },
    { id: 'users', label: t('admin.users'), show: can('users.view') },
    { id: 'roles', label: t('admin.roles'), show: can('roles.manage') },
    { id: 'navigation', label: t('admin.navigation'), show: can('navigation.manage') },
    { id: 'dashboards', label: t('settings.admin.dashboards'), show: can('dashboards.edit') },
    { id: 'requests', label: t('settings.admin.requests'), show: can('access_requests.manage') },
    { id: 'support', label: t('settings.admin.support'), show: can('support.view') },
    { id: 'overview', label: t('admin.overview'), show: can('users.view') },
    { id: 'profile', label: t('settings.profile'), show: true },
    { id: 'workspace', label: t('settings.workspace'), show: true },
  ].filter((item) => item.show), [can, t])
  const requested = params.get('panel')
  const panel = panels.some((item) => item.id === requested) ? requested! : (admin && panels[0] ? panels[0].id : 'workspace')
  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={admin ? t('settings.admin.subtitle') : undefined} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: admin ? '220px 1fr' : '1fr' }, gap: 2, alignItems: 'start' }}>
        {admin && (
          <>
            <FormControl fullWidth size="small" sx={{ display: { xs: 'flex', md: 'none' } }}>
              <InputLabel>{t('settings.title')}</InputLabel>
              <Select label={t('settings.title')} value={panel} onChange={(e) => setParams({ panel: String(e.target.value) })}>
                {panels.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <List dense sx={{ display: { xs: 'none', md: 'block' }, border: 1, borderColor: 'divider', borderRadius: 2, py: 0.5 }}>
            {panels.map((item) => (
              <ListItemButton key={item.id} selected={panel === item.id} onClick={() => setParams({ panel: item.id })}>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13, fontWeight: panel === item.id ? 700 : 500 }} />
              </ListItemButton>
            ))}
            </List>
          </>
        )}
        <Box sx={{ minWidth: 0 }}>
          {panel === 'permissions' && <PagePermissions />}
          {panel === 'grantors' && <GrantAuthorityPanel />}
          {panel === 'users' && <UsersPanel />}
          {panel === 'roles' && <RolesPanel />}
          {panel === 'navigation' && <NavigationPanel />}
          {panel === 'dashboards' && <DashboardBuilder />}
          {panel === 'requests' && <AccessRequestsPanel />}
          {panel === 'support' && <AdminSupportPanel />}
          {panel === 'overview' && <Overview />}
          {panel === 'profile' && <ProfileSettings />}
          {panel === 'workspace' && <WorkspaceSettings />}
        </Box>
      </Box>
    </>
  )
}

function ProfileSettings() {
  const { t } = useTranslation()
  const { user, can, refreshUser } = useAuth()
  const { preferences, update } = usePreferences()
  const editable = can('profile.edit') || can('users.edit')
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    full_name: user?.full_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    job_title: user?.job_title ?? '',
  })
  useEffect(() => {
    if (!user) return
    setForm({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      full_name: user.full_name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      job_title: user.job_title ?? '',
    })
  }, [user])
  const save = useMutation({
    mutationFn: async () => {
      await api.patch('/me', { ...form, email: form.email || null })
      if (preferences?.allow_locale || preferences?.allow_theme) await refreshUser()
    },
    onSuccess: refreshUser,
  })
  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{t('settings.profile')}</Typography>
      <Card>
        <CardContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label={t('registration.firstName')} value={form.first_name} disabled={!editable} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          <TextField label={t('registration.lastName')} value={form.last_name} disabled={!editable} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          <TextField label={t('registration.displayName')} value={form.full_name} disabled={!editable} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <TextField label={t('registration.emailOptional')} value={form.email} disabled={!editable} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label={t('registration.phoneOptional')} value={form.phone} disabled={!editable} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label={t('settings.position')} value={form.job_title} disabled={!editable} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          <FormControl disabled={!preferences?.allow_locale}><InputLabel>{t('settings.language')}</InputLabel><Select label={t('settings.language')} value={preferences?.locale ?? 'en'} onChange={(e) => void update({ locale: e.target.value as 'en' | 'he' })}><MenuItem value="en">English</MenuItem><MenuItem value="he">עברית</MenuItem></Select></FormControl>
          <FormControl disabled={!preferences?.allow_theme}><InputLabel>{t('settings.appearance')}</InputLabel><Select label={t('settings.appearance')} value={preferences?.theme ?? 'system'} onChange={(e) => void update({ theme: e.target.value as 'light' | 'dark' | 'system' })}><MenuItem value="light">{t('settings.light')}</MenuItem><MenuItem value="dark">{t('settings.dark')}</MenuItem><MenuItem value="system">{t('settings.system')}</MenuItem></Select></FormControl>
          {editable && <Button variant="contained" disabled={save.isPending || form.full_name.trim().length < 2} onClick={() => save.mutate()} sx={{ gridColumn: { sm: '1 / -1' } }}>{t('common.save')}</Button>}
          {save.isSuccess && <Alert severity="success" sx={{ gridColumn: { sm: '1 / -1' } }}>{t('settings.admin.saved')}</Alert>}
          {save.isError && <Alert severity="error" sx={{ gridColumn: { sm: '1 / -1' } }}>{t('common.saveError')}</Alert>}
          {!editable && <Typography color="text.secondary" sx={{ gridColumn: { sm: '1 / -1' } }}>{t('settings.profileLocked')}</Typography>}
        </CardContent>
      </Card>
    </Box>
  )
}

function WorkspaceSettings() {
  const { t } = useTranslation()
  const { preferences, update } = usePreferences()
  const { user, can, refreshUser } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [colors, setColors] = useState({ primary_color: user?.workspace_primary_color ?? '#176B5B', secondary_color: user?.workspace_secondary_color ?? '#3156C8' })
  const save = useMutation({ mutationFn: () => api.patch('/workspace/settings', colors), onSuccess: refreshUser })
  const logo = useMutation({ mutationFn: async (file: File) => { const body = new FormData(); body.append('file', file); return api.post('/workspace/logo', body) }, onSuccess: refreshUser })
  const remove = useMutation({ mutationFn: () => api.delete('/workspace/logo'), onSuccess: refreshUser })
  return (
    <Stack spacing={2}>
      <Card>
        <CardContent sx={{ display: 'grid', gap: 3, maxWidth: 520 }}>
          <Typography variant="h6">{t('settings.personal')}</Typography>
          <FormControl disabled={!preferences?.allow_locale}><InputLabel>{t('settings.language')}</InputLabel><Select label={t('settings.language')} value={preferences?.locale ?? 'en'} onChange={(e) => void update({ locale: e.target.value as 'en' | 'he' })}><MenuItem value="en">English</MenuItem><MenuItem value="he">עברית</MenuItem></Select></FormControl>
          <FormControl disabled={!preferences?.allow_theme}><InputLabel>{t('settings.appearance')}</InputLabel><Select label={t('settings.appearance')} value={preferences?.theme ?? 'system'} onChange={(e) => void update({ theme: e.target.value as 'light' | 'dark' | 'system' })}><MenuItem value="light">{t('settings.light')}</MenuItem><MenuItem value="dark">{t('settings.dark')}</MenuItem><MenuItem value="system">{t('settings.system')}</MenuItem></Select></FormControl>
        </CardContent>
      </Card>
      {can('settings.manage') && (
        <Card>
          <CardContent sx={{ display: 'grid', gap: 2, maxWidth: 620 }}>
            <Typography variant="h6">{user?.workspace_type === 'band' ? 'Band branding' : 'Workspace branding'}</Typography>
            <Typography color="text.secondary">Syncora remains the platform identity. These accents identify {user?.workspace_name}.</Typography>
            <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) logo.mutate(file); e.target.value = '' }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
              <Button startIcon={<UploadFile />} variant="outlined" onClick={() => input.current?.click()}>Replace logo</Button>
              {user?.workspace_logo_url && <Button color="error" startIcon={<DeleteOutline />} onClick={() => remove.mutate()}>Remove logo</Button>}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField label="Primary accent" type="color" value={colors.primary_color} onChange={(e) => setColors({ ...colors, primary_color: e.target.value })} fullWidth />
              <TextField label="Secondary accent" type="color" value={colors.secondary_color} onChange={(e) => setColors({ ...colors, secondary_color: e.target.value })} fullWidth />
            </Stack>
            <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} sx={{ justifySelf: 'start' }}>Save workspace branding</Button>
            {(logo.isError || save.isError) && <Typography color="error">Branding could not be saved. Check the image and colors.</Typography>}
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}
