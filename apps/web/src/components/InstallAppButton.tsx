import InstallDesktop from '@mui/icons-material/InstallDesktop'
import IosShare from '@mui/icons-material/IosShare'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip, Typography } from '@mui/material'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { canNativeInstall, isIosDevice, isStandaloneApp, promptInstall, subscribeInstallAvailable } from '../pwa/install'

export function useWorkspaceInstall() {
  const { t } = useTranslation()
  const [installed, setInstalled] = useState(isStandaloneApp)
  const [available, setAvailable] = useState(canNativeInstall)
  const [help, setHelp] = useState(false)
  const ios = isIosDevice()

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

  async function install() {
    if (available) {
      const accepted = await promptInstall()
      if (accepted) setInstalled(true)
      return
    }
    setHelp(true)
  }

  const helpDialog = (
    <Dialog open={help} onClose={() => setHelp(false)} fullWidth maxWidth="xs">
      <DialogTitle>{t('install.title')}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1.5 }}>{ios ? t('install.ios') : t('install.browser')}</Typography>
        {ios && (
          <Typography color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IosShare fontSize="small" /> {t('install.iosShare')}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setHelp(false)}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )

  return { installed, available, install, helpDialog }
}

export function InstallAppButton({ variant = 'icon' }: { variant?: 'icon' | 'button' }) {
  const { t } = useTranslation()
  const { user, can } = useAuth()
  const { installed, install, helpDialog } = useWorkspaceInstall()
  const allowed = !user || (can('app.install.navbar') && user.install_prompt?.navbar !== false)
  if (installed || !allowed) return null
  const label = t('install.action')
  const tooltip = t('install.tooltip')
  const control: ReactNode = variant === 'button' ? (
    <Button variant="contained" size="small" startIcon={<InstallDesktop />} onClick={() => void install()} sx={{ flexShrink: 0 }}>
      {label}
    </Button>
  ) : (
    <Tooltip title={tooltip}>
      <IconButton color="inherit" aria-label={tooltip} onClick={() => void install()}>
        <InstallDesktop />
      </IconButton>
    </Tooltip>
  )
  return (
    <>
      {control}
      {helpDialog}
    </>
  )
}
