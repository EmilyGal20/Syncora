import { Link } from 'react-router-dom'
import wordmark from '../assets/brand/syncora-wordmark.png'
import board from '../assets/landing/board.png'
import dashboard from '../assets/landing/dashboard.png'
import projects from '../assets/landing/projects.png'
import schedule from '../assets/landing/schedule.png'
import { useAuth } from '../auth/AuthProvider'
import { InstallAppButton, useWorkspaceInstall } from '../components/InstallAppButton'
import './landing.css'

const pills = ['Tasks', 'Schedule', 'Projects', 'Booking', 'Files', 'Notes']

const features = [
  { title: 'Workspaces', text: 'Each organization gets its own workspace, roles, and branding.' },
  { title: 'Task engine', text: 'Priorities, boards, projects, and progress in one working flow.' },
  { title: 'Schedule', text: 'Calendar, meetings, and guest booking links without another tool.' },
  { title: 'Access', text: 'Each person sees the pages and actions meant for them.' },
  { title: 'Files and notes', text: 'Shared files and private or team notes stay with the workspace.' },
  { title: 'Any device', text: 'The same app on a computer and on a phone, installed from the browser.' },
]

const views = [
  { src: board, title: 'Task board', text: 'Priorities, projects, and progress on one board.', alt: 'Syncora task board with To Do, In Progress, and Completed columns', wide: true },
  { src: projects, title: 'Projects', text: 'Group related work and follow progress in the workspace.', alt: 'Syncora projects with progress for each project', wide: false },
  { src: schedule, title: 'Schedule and booking', text: 'Internal calendar plus guest meeting links.', alt: 'Syncora monthly schedule with booking actions', wide: false },
]

const devices = [
  {
    title: 'Computer',
    text: 'Chrome or Edge installs Syncora onto this computer. It then opens in its own window.',
    steps: ['Open this page in Chrome or Edge.', 'Choose Install app.', 'Launch it from the desktop, Dock, or Start menu.'],
  },
  {
    title: 'Phone',
    text: 'The same address becomes a home-screen app. There is no store and no extra download.',
    steps: ['Open this page in Safari or Chrome.', 'iPhone: Share, then Add to Home Screen.', 'Android: browser menu, then Install app.'],
  },
]

export function LandingPage() {
  const { user } = useAuth()
  const { installed } = useWorkspaceInstall()
  const enter = user ? { to: '/dashboard', label: 'Open workspace' } : { to: '/login', label: 'Sign in' }

  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="lp-wrap lp-bar-inner">
          <Link to="/landing-guide" className="lp-brand" aria-label="Syncora home">
            <img src={wordmark} alt="Syncora" />
          </Link>
          <nav className="lp-nav" aria-label="Landing">
            <a href="#product">Product</a>
            <a href="#install">Install</a>
            <InstallAppButton variant="button" />
            <Link className="lp-btn primary" to={enter.to}>{enter.label}</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero" id="intro">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-copy">
              <p className="lp-kicker">Plan · Manage · Connect</p>
              <h1>Plan, manage, and connect the workspace</h1>
              <p className="lp-lead">
                Syncora is the operating layer for daily work: tasks, calendars, teams, files, notes, booking, and permissions. Install it from the browser onto a computer or a phone.
              </p>
              <ul className="lp-pills">
                {pills.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <div className="lp-actions">
                <Link className="lp-btn primary" to={enter.to}>{enter.label}</Link>
                <a className="lp-btn" href="#install">Install the app</a>
              </div>
            </div>

            <div className="lp-stage">
              <img className="lp-shot" src={dashboard} alt="Syncora dashboard with open tasks, announcements, and the task engine" />
            </div>
          </div>
        </section>

        <section className="lp-block" id="product">
          <div className="lp-wrap">
            <div className="lp-intro">
              <p className="lp-kicker">Product</p>
              <h2>What you run in Syncora</h2>
              <p>One branded workspace for the organization. People see only the pages and actions they are allowed to use.</p>
            </div>
            <ul className="lp-grid">
              {features.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-block lp-muted" id="views">
          <div className="lp-wrap">
            <div className="lp-intro">
              <p className="lp-kicker">Product surfaces</p>
              <h2>From dashboard to delivery</h2>
              <p>The same installed app on a large monitor, a laptop, or a phone home screen.</p>
            </div>
            <div className="lp-mosaic">
              {views.map((item) => (
                <article className={item.wide ? 'is-wide' : undefined} key={item.title}>
                  <img className="lp-shot" src={item.src} alt={item.alt} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

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
                <p>{installed ? 'Open it from the desktop, the Start menu, or the phone home screen.' : 'Use the button to install the web app. On iPhone, the steps above add it to the home screen.'}</p>
              </div>
              <div className="lp-actions">
                <InstallAppButton variant="button" />
                <Link className="lp-btn light" to={enter.to}>{enter.label}</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-inner">
          <span>Syncora</span>
          <span className="lp-dot" />
          <span>Plan, Manage, Connect</span>
          <nav>
            <a href="#install">Install</a>
            <Link to={enter.to}>{enter.label}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
