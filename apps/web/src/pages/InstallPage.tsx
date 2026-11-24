import { Link } from 'react-router-dom'
import wordmark from '../assets/brand/syncora-wordmark.png'
import { useAuth } from '../auth/AuthProvider'
import { InstallAppButton, useWorkspaceInstall } from '../components/InstallAppButton'
import './landing.css'

const devices = [
  {
    title: 'Computer',
    text: 'Chrome or Edge installs Syncora onto this computer. It then opens in its own window.',
    steps: ['Stay on this page in Chrome or Edge.', 'Choose Install app.', 'Launch it from the desktop, Dock, or Start menu.'],
  },
  {
    title: 'Phone',
    text: 'This same address becomes a home-screen app. There is no store and no extra download.',
    steps: ['Open this page in Safari or Chrome.', 'iPhone: Share, then Add to Home Screen.', 'Android: browser menu, then Install app.'],
  },
]

export function InstallPage() {
  const { user } = useAuth()
  const { installed } = useWorkspaceInstall()
  const enter = user ? { to: '/dashboard', label: 'Open workspace' } : { to: '/login', label: 'Sign in' }

  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="lp-wrap lp-bar-inner">
          <Link to={enter.to} className="lp-brand" aria-label="Syncora">
            <img src={wordmark} alt="Syncora" />
          </Link>
          <nav className="lp-nav" aria-label="Install">
            <InstallAppButton variant="button" />
            <Link className="lp-btn primary" to={enter.to}>{enter.label}</Link>
          </nav>
        </div>
      </header>
      <main>
        <section className="lp-block" id="install">
          <div className="lp-wrap">
            <div className="lp-intro">
              <p className="lp-kicker">Install</p>
              <h2>A web app, installed directly</h2>
              <p>Syncora installs from this browser onto a computer or a phone. Nothing else to download, and no extra software to set up.</p>
            </div>
            <div className="lp-devices">
              {devices.map((device) => (
                <article key={device.title}>
                  <h3>{device.title}</h3>
                  <p>{device.text}</p>
                  <ol>
                    {device.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                </article>
              ))}
            </div>
            <div className="lp-install-bar">
              <div>
                <h2>{installed ? 'Syncora is installed on this device' : 'Install it on this device'}</h2>
                <p>{installed ? 'Open it from the desktop, the Start menu, or the phone home screen, then sign in.' : 'Use Install app here. On iPhone, follow the steps above, then sign in.'}</p>
              </div>
              <div className="lp-actions">
                <InstallAppButton variant="button" />
                <Link className="lp-btn light" to={enter.to}>{enter.label}</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
