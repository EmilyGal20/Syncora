import GetApp from '@mui/icons-material/GetApp'
import IosShare from '@mui/icons-material/IosShare'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canNativeInstall, isIosDevice, isStandaloneApp, promptInstall, subscribeInstallAvailable } from '../pwa/install'

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
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

  if (installed) return null

  async function install() {
    if (available) {
      const accepted = await promptInstall()
      if (accepted) setInstalled(true)
      return
    }
    setHelp(true)
  }

  const label = t('install.action')
  return (
    <>
      {compact ? (
        <IconButton color="primary" aria-label={label} onClick={() => void install()}>
          <GetApp />
        </IconButton>
      ) : (
        <Button variant="contained" size="small" startIcon={<GetApp />} onClick={() => void install()} sx={{ display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0 }}>
          {label}
        </Button>
      )}
      {compact ? null : (
        <IconButton color="primary" aria-label={label} onClick={() => void install()} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
          <GetApp />
        </IconButton>
      )}
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
    </>
  )
}
