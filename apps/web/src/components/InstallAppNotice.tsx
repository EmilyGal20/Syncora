import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { isStandaloneApp, shouldAskInstall } from '../pwa/install'
import { openInstallDialog, useWorkspaceInstall } from './InstallAppButton'

interface VisibleNotice { id: string; message: string }

const hiddenKey = (userId: string) => `syncora_install_prompt_hidden_${userId}`
const seenKey = (userId: string) => `syncora_install_prompt_seen_${userId}`

export function InstallAppNotice() {
  const { t } = useTranslation()
  const { user, can } = useAuth()
  const { installed } = useWorkspaceInstall()
  const [open, setOpen] = useState(false)
  const [dontShow, setDontShow] = useState(false)
  const [openInstallAfterClose, setOpenInstallAfterClose] = useState(false)
  const notices = useQuery({
    queryKey: ['visible-app-notices'],
    enabled: !!user,
    queryFn: async () => (await api.get<VisibleNotice[]>('/app-notices')).data,
  })

  useEffect(() => {
    if (!user) return
    const allowed = can('app.install.notice') && user.install_prompt?.notice !== false
    const hidden = localStorage.getItem(hiddenKey(user.id)) === '1'
    const seen = sessionStorage.getItem(seenKey(user.id)) === '1'
    setOpen(shouldAskInstall({ allowed, installed: installed || isStandaloneApp(), hidden, seen }))
  }, [user, can, installed, notices.data])

  function remember() {
    if (!user) return
    sessionStorage.setItem(seenKey(user.id), '1')
    if (dontShow) localStorage.setItem(hiddenKey(user.id), '1')
    setOpen(false)
  }

  function accept() {
    setOpenInstallAfterClose(true)
    remember()
  }

  function finishedClosing() {
    if (!openInstallAfterClose) return
    setOpenInstallAfterClose(false)
    openInstallDialog()
  }

  const message = notices.data?.find((item) => item.message.trim())?.message.trim() || t('install.notice')
  return (
    <Dialog open={open} onClose={remember} TransitionProps={{ onExited: finishedClosing }} fullWidth maxWidth="xs">
      <DialogTitle>{t('install.askTitle')}</DialogTitle>
      <DialogContent>
        <Typography>{message}</Typography>
        <FormControlLabel
          sx={{ display: 'flex', mt: 1 }}
          control={<Checkbox checked={dontShow} onChange={(_, checked) => setDontShow(checked)} />}
          label={t('install.dontShowAgain')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={remember}>{t('install.askNo')}</Button>
        <Button variant="contained" onClick={accept}>{t('install.askYes')}</Button>
      </DialogActions>
    </Dialog>
  )
}
