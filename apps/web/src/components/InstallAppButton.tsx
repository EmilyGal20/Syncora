import InstallDesktop from '@mui/icons-material/InstallDesktop'
import IosShare from '@mui/icons-material/IosShare'
import { Button, Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { canNativeInstall, isIosDevice, isStandaloneApp, promptInstall, subscribeInstallAvailable } from '../pwa/install'
import { EnableSystemNotifications } from './EnableSystemNotifications'

const openEvent = 'syncora:open-install-dialog'
const closeEvent = 'syncora:close-install-dialog'

export function openInstallDialog() {
  window.dispatchEvent(new Event(openEvent))
}

export function closeInstallDialog() {
  window.dispatchEvent(new Event(closeEvent))
}

function useInstallDialogOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const show = () => setOpen(true)
    const hide = () => setOpen(false)
    window.addEventListener(openEvent, show)
    window.addEventListener(closeEvent, hide)
    return () => {
      window.removeEventListener(openEvent, show)
      window.removeEventListener(closeEvent, hide)
    }
  }, [])
  return open
}

export function useWorkspaceInstall() {
  const [installed, setInstalled] = useState(isStandaloneApp)
  const [available, setAvailable] = useState(canNativeInstall)

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)')
    const sync = () => {
      setInstalled(isStandaloneApp())
      setAvailable(canNativeInstall())
    }
    sync()
    media?.addEventListener('change', sync)
    const stop = subscribeInstallAvailable(sync)
    return () => {
      media?.removeEventListener('change', sync)
      stop()
    }
  }, [])

  async function installNow() {
    if (!available) return false
    const accepted = await promptInstall()
    if (accepted) setInstalled(true)
    return accepted
  }

  return { installed, available, installNow }
}

export function InstallHelpHost() {
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const open = useInstallDialogOpen()
  const { installNow } = useWorkspaceInstall()
  const ios = isIosDevice()

  useEffect(() => {
    if (open) void refreshUser()
  }, [open, refreshUser])

  async function installFromDialog() {
    const accepted = await installNow()
    if (accepted) closeInstallDialog()
  }

  return (
    <Dialog open={open} onClose={closeInstallDialog} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: 'primary.contrastText', flexShrink: 0, backgroundImage: (theme) => `linear-gradient(120deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` }}>
          <InstallDesktop fontSize="small" />
        </Box>
        {t('install.title')}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5 }}>
        <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>{ios ? t('install.ios') : t('install.browser')}</Typography>
        {ios && (
          <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
            <IosShare fontSize="small" /> {t('install.iosShare')}
          </Typography>
        )}
        <EnableSystemNotifications />
      </DialogContent>
      <DialogActions disableSpacing sx={{ px: 3, pt: 1, pb: 2.5, gap: 1 }}>
        <Button onClick={closeInstallDialog} sx={{ color: 'text.secondary' }}>{t('common.close')}</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<InstallDesktop />} onClick={() => void installFromDialog()}>{t('install.action')}</Button>
      </DialogActions>
    </Dialog>
  )
}

export function InstallAppButton({ variant = 'icon' }: { variant?: 'icon' | 'button' }) {
  const { t } = useTranslation()
  const { user, can } = useAuth()
  const { installed } = useWorkspaceInstall()
  const allowed = !user || (can('app.install.navbar') && user.install_prompt?.navbar !== false)
  if (installed || !allowed) return null
  const label = t('install.action')
  const tooltip = t('install.tooltip')
  const control: ReactNode = variant === 'button' ? (
    <Button variant="contained" size="small" startIcon={<InstallDesktop />} onClick={openInstallDialog} sx={{ flexShrink: 0 }}>
      {label}
    </Button>
  ) : (
    <Tooltip title={tooltip}>
      <IconButton color="inherit" aria-label={tooltip} onClick={openInstallDialog}>
        <InstallDesktop />
      </IconButton>
    </Tooltip>
  )
  return control
}
