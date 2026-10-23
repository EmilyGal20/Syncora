import { Alert, Box, Button, Card, CardContent, FormControlLabel, Switch, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

export function InstallPromptSettings({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation()
  const { user, can, refreshUser } = useAuth()
  const editable = can('app.install.manage') || can('settings.manage')
  const [form, setForm] = useState({
    navbar: user?.install_prompt?.navbar ?? true,
    notice: user?.install_prompt?.notice ?? true,
    message: user?.install_prompt?.message ?? '',
  })
  useEffect(() => {
    setForm({
      navbar: user?.install_prompt?.navbar ?? true,
      notice: user?.install_prompt?.notice ?? true,
      message: user?.install_prompt?.message ?? '',
    })
  }, [user?.install_prompt])
  const save = useMutation({
    mutationFn: () => api.patch('/workspace/install-prompt', form),
    onSuccess: refreshUser,
  })
  return (
    <Card sx={{ mb: embedded ? 2 : 0 }}>
      <CardContent sx={{ display: 'grid', gap: 2, maxWidth: 640 }}>
        <Box>
          <Typography variant="h6">{t('install.settingsTitle')}</Typography>
          <Typography color="text.secondary">{t('install.settingsHelp')}</Typography>
        </Box>
        <FormControlLabel control={<Switch checked={form.navbar} disabled={!editable} onChange={(_, checked) => setForm({ ...form, navbar: checked })} />} label={t('install.showNavbar')} />
        <FormControlLabel control={<Switch checked={form.notice} disabled={!editable} onChange={(_, checked) => setForm({ ...form, notice: checked })} />} label={t('install.showNotice')} />
        <TextField
          label={t('install.noticeMessage')}
          value={form.message}
          disabled={!editable}
          onChange={(event) => setForm({ ...form, message: event.target.value.slice(0, 400) })}
          helperText={t('install.noticeMessageHelp')}
          multiline
          minRows={2}
        />
        {editable && <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} sx={{ justifySelf: 'start' }}>{t('common.save')}</Button>}
        {save.isSuccess && <Alert severity="success">{t('settings.admin.saved')}</Alert>}
        {save.isError && <Alert severity="error">{t('common.saveError')}</Alert>}
      </CardContent>
    </Card>
  )
}
