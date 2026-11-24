import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { setSystemNotificationHandler, showWindowsNotification, type SystemNotificationPayload } from '../pwa/systemNotifications'

interface Policy { types: Record<string, boolean>; deliver: boolean }

export function SystemNotificationBridge() {
  const { user, can } = useAuth()
  const allowed = !!user && can('system_notifications.receive') && can('system_notifications.enabled')
  const policy = useQuery({
    queryKey: ['system-notifications', user?.id],
    enabled: allowed,
    staleTime: 30_000,
    queryFn: async () => (await api.get<Policy>('/system-notifications')).data,
  })

  useEffect(() => {
    return setSystemNotificationHandler((payload: SystemNotificationPayload) => {
      const current = policy.data
      if (!current?.deliver || !payload.type || current.types[payload.type] === false) return
      void showWindowsNotification(payload.title || '', payload.message || '', payload.route)
    })
  }, [policy.data])

  return null
}
