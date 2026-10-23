import { useEffect, useState, type ButtonHTMLAttributes } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
      setPromptEvent(null)
      return
    }
    if (isIos() && !installed) setIosHelp(true)
  }

  return { canPrompt: Boolean(promptEvent), installed, ios: isIos(), iosHelp, install, setIosHelp }
}

export function InstallAppButton({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { installed, install, iosHelp } = usePwaInstall()
  if (installed) return null
  return (
    <>
      <button type="button" className={className} onClick={() => void install()} {...props}>
        {children ?? 'Install app'}
      </button>
      {iosHelp && <p className="sy-lead">On iPhone: tap Share, then Add to Home Screen. Syncora opens like an app.</p>}
    </>
  )
}
