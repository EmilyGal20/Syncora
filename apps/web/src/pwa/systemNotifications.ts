import { isStandaloneApp } from './install'

export interface SystemNotificationPayload {
  type?: string
  title?: string
  message?: string
  route?: string | null
}

type Handler = (payload: SystemNotificationPayload) => void

let handler: Handler | null = null

export function setSystemNotificationHandler(next: Handler) {
  handler = next
  return () => {
    if (handler === next) handler = null
  }
}

export function forwardSystemNotification(payload: SystemNotificationPayload) {
  handler?.(payload)
}

export function notificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported' as const
  return Notification.permission
}

export async function enableSystemNotifications() {
  if (typeof Notification === 'undefined') return 'unsupported' as const
  return Notification.requestPermission()
}

export async function showWindowsNotification(title: string, body: string, route?: string | null) {
  if (!isStandaloneApp() || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const text = title.trim()
  if (!text) return
  const options: NotificationOptions = {
    body: body.trim(),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { route: route || '/dashboard' },
  }
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : null
  if (registration) {
    await registration.showNotification(text, options)
    return
  }
  new Notification(text, options)
}
