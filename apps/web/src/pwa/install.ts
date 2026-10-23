type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: PromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function isStandaloneApp() {
  if (typeof window === 'undefined') return false
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const display = (query: string) => Boolean(window.matchMedia?.(query)?.matches)
  return ios || display('(display-mode: standalone)') || display('(display-mode: window-controls-overlay)')
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function canNativeInstall() {
  return deferred !== null
}

export function subscribeInstallAvailable(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall() {
  if (!deferred) return false
  const event = deferred
  deferred = null
  notify()
  await event.prompt()
  const choice = await event.userChoice
  return choice.outcome === 'accepted'
}

export function registerSyncoraPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as PromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js')
  }
}
