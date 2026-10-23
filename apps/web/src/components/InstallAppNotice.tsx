import InstallDesktop from '@mui/icons-material/InstallDesktop'
import { Alert, Button, Snackbar } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { isStandaloneApp } from '../pwa/install'
import { useWorkspaceInstall } from './InstallAppButton'

interface VisibleNotice { id: string; message: string }

const seenKey = (id: string) => `syncora_install_notice_${id}`

export function InstallAppNotice() {
  const { t } = useTranslation()
  const { install, helpDialog } = useWorkspaceInstall()
  const [current, setCurrent] = useState<VisibleNotice | null>(null)
  const notices = useQuery({
    queryKey: ['visible-app-notices'],
    queryFn: async () => (await api.get<VisibleNotice[]>('/app-notices')).data,
  })
  const pending = useMemo(
    () => (notices.data ?? []).filter((item) => !sessionStorage.getItem(seenKey(item.id))),
    [notices.data],
  )

  useEffect(() => {
    if (isStandaloneApp()) {
      setCurrent(null)
      return
    }
    setCurrent(pending[0] ?? null)
  }, [pending])

  function dismiss() {
    if (current) sessionStorage.setItem(seenKey(current.id), '1')
    const rest = pending.filter((item) => item.id !== current?.id)
    setCurrent(rest[0] ?? null)
  }

  async function installNow() {
    await install()
    dismiss()
  }

  const message = current?.message.trim() || t('install.notice')
  return (
    <>
      <Snackbar open={Boolean(current)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity="info"
          icon={<InstallDesktop />}
          onClose={dismiss}
          action={
            <Button color="inherit" size="small" onClick={() => void installNow()}>
              {t('install.noticeAction')}
            </Button>
          }
          sx={{ alignItems: 'center' }}
        >
          {message}
        </Alert>
      </Snackbar>
      {helpDialog}
    </>
  )
}
