import NotificationsActive from '@mui/icons-material/NotificationsActive'
import NotificationsOff from '@mui/icons-material/NotificationsOff'
import { Alert, Box, Button, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { isStandaloneApp } from '../pwa/install'
import { enableSystemNotifications, notificationPermission } from '../pwa/systemNotifications'

export function EnableSystemNotifications() {
  const { t } = useTranslation()
  const { user, can } = useAuth()
  const [permission, setPermission] = useState(notificationPermission)
  if (!user || !can('system_notifications.button')) return null

  async function enable() {
    const next = await enableSystemNotifications()
    setPermission(next === 'unsupported' ? 'denied' : next)
  }

  const granted = permission === 'granted'
  const blocked = permission === 'denied'
  return (
    <Box sx={{ mt: 2.5, p: 1.75, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: 'background.paper', color: granted ? 'success.main' : blocked ? 'warning.main' : 'primary.main' }}>
          {blocked ? <NotificationsOff fontSize="small" /> : <NotificationsActive fontSize="small" />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700}>{granted ? t('systemNotifications.enabled') : t('systemNotifications.enable')}</Typography>
          {!blocked && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.45 }}>
              {!isStandaloneApp() ? t('systemNotifications.needInstall') : granted ? t('systemNotifications.ready') : t('systemNotifications.panelHelp')}
            </Typography>
          )}
        </Box>
      </Box>
      {!granted && !blocked && (
        <Button fullWidth variant="outlined" sx={{ mt: 1.5, bgcolor: 'background.paper' }} startIcon={<NotificationsActive />} onClick={() => void enable()}>
          {t('systemNotifications.enable')}
        </Button>
      )}
      {blocked && <Alert severity="warning" sx={{ mt: 1.5 }}>{t('systemNotifications.denied')}</Alert>}
    </Box>
  )
}
