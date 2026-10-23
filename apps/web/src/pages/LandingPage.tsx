import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import mark from '../assets/brand/syncora-mark.png'
import wordmark from '../assets/brand/syncora-wordmark.png'
import { InstallAppButton } from '../components/InstallAppButton'
import { MarketingFrame } from '../marketing/MarketingFrame'

const pills = ['Tasks', 'Schedule', 'Permissions', 'Booking', 'Files', 'Notes']
const features = [
  { title: 'Workspaces', text: 'Every organization gets its own workspace, roles, and branding.' },
  { title: 'Task engine', text: 'Priorities, boards, projects, planner, and progress in one flow.' },
  { title: 'Schedule', text: 'Calendar, meetings, and guest booking links without extra tools.' },
  { title: 'Access', text: 'Page-level permissions, roles, and personal overrides.' },
  { title: 'Files & notes', text: 'Shared files and private or team notes stay with the workspace.' },
  { title: 'Anywhere', text: 'Windows app, same Wi-Fi phone install, or localhost for development.' },
]

function PlusGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heroRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const hero = canvas?.closest('section')
    if (!canvas || !hero) return
    heroRef.current = hero
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cols = 0, rows = 0, gapX = 0, gapY = 0, width = 0, height = 0, raf = 0
    let energy = new Float32Array(0)
    const layout = () => {
      const rect = hero.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const target = width < 400 ? 34 : 40
      cols = Math.max(6, Math.floor(width / target))
      rows = Math.max(8, Math.floor(height / target))
      gapX = width / (cols + 1)
      gapY = height / (rows + 1)
      energy = new Float32Array(cols * rows)
    }
    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.font = '700 11px Segoe UI, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let active = false
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const i = r * cols + c
          const current = energy[i] ?? 0
          const next = current > 0.001 ? Math.max(0, current - 0.02) : 0
          energy[i] = next
          if (next > 0.001) active = true
          ctx.fillStyle = `rgba(79, 70, 229, ${Math.min(0.85, 0.16 + next * 0.7)})`
          ctx.fillText('+', gapX + c * gapX, gapY + r * gapY)
        }
      }
      raf = active ? requestAnimationFrame(draw) : 0
    }
    const ripple = (clientX: number, clientY: number) => {
      if (reduced || !energy.length) return
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const radius = Math.max(gapX, gapY) * 2.4
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const dist = Math.hypot(gapX + c * gapX - x, gapY + r * gapY - y)
          if (dist > radius) continue
          const t = 1 - dist / radius
          const i = r * cols + c
          energy[i] = Math.min(1, (energy[i] ?? 0) + t * t * 0.95)
        }
      }
      if (!raf) raf = requestAnimationFrame(draw)
    }
    layout()
    draw()
    const onPointer = (event: PointerEvent) => ripple(event.clientX, event.clientY)
    const onResize = () => { layout(); if (!raf) raf = requestAnimationFrame(draw) }
    hero.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', onResize)
    return () => {
      hero.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])
  return <canvas ref={canvasRef} className="sy-plus" aria-hidden="true" />
}

export function LandingPage() {
  return (
    <MarketingFrame>
      <section className="sy-section sy-hero" id="intro">
        <PlusGrid />
        <div className="sy-mark">
          <button type="button" className="sy-mark-hit" aria-label="Syncora">
            <img src={mark} alt="" className="sy-logo-lockup" style={{ width: 'min(28vw, 7.5rem)', margin: '0 auto' }} />
            <img src={wordmark} alt="Syncora — Plan, Manage, Connect" className="sy-word" style={{ display: 'block', margin: '0.85rem auto 0' }} />
          </button>
        </div>
        <h1>Plan, manage, and connect the workspace</h1>
        <p className="sy-lead">Syncora is the operating layer for daily work: tasks, calendars, teams, files, notes, booking, and permissions — as a desktop app, on a phone over Wi-Fi, or in local development.</p>
        <div className="sy-pills">{pills.map((item) => <span key={item}>{item}</span>)}</div>
        <div className="sy-actions">
          <InstallAppButton />
          <Link className="sy-btn" to="/login">Sign in</Link>
          <Link className="sy-btn" to="/install">Installation guide</Link>
        </div>
        <a className="sy-scroll" href="#platform" aria-label="See what Syncora includes"><span /><span /></a>
      </section>
      <div className="sy-marquee" aria-hidden="true">
        <div className="sy-marquee-track">
          {['Dashboard', 'Task engine', 'Schedule', 'Booking', 'Roles', 'Files', 'Notes', 'Hebrew & English', 'Light & dark',
            'Dashboard', 'Task engine', 'Schedule', 'Booking', 'Roles', 'Files', 'Notes', 'Hebrew & English', 'Light & dark'].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
      <section className="sy-section" id="platform">
        <h2>What you run in Syncora</h2>
        <p className="sy-lead">One branded workspace for the organization. People see only the pages and actions they are allowed to use.</p>
        <ul className="sy-grid">
          {features.map((item) => (
            <li className="sy-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="sy-section" id="views">
        <h2>From dashboard to delivery</h2>
        <p className="sy-lead">The same product on a large monitor, a laptop, or a phone home-screen install.</p>
        <div className="sy-mosaic">
          <figure className="sy-shot sy-wide">
            <figcaption>Workspace</figcaption>
            <div className="sy-ui"><b /><i /></div>
            <strong>Home dashboard</strong>
            <em>Greeting, widgets, and the task engine in one place.</em>
          </figure>
          <figure className="sy-shot">
            <figcaption>Control</figcaption>
            <div className="sy-ui"><b /><i /></div>
            <strong>Permissions</strong>
            <em>Roles, pages, and per-user access.</em>
          </figure>
          <figure className="sy-shot">
            <figcaption>Time</figcaption>
            <div className="sy-ui"><b /><i /></div>
            <strong>Schedule & booking</strong>
            <em>Internal calendar plus guest meeting links.</em>
          </figure>
        </div>
      </section>
      <section className="sy-section sy-close" id="closing">
        <h2>Install it, then work from anywhere it runs</h2>
        <p className="sy-cta">Windows double-click, phone on the same Wi-Fi, or localhost for development. No hosted Syncora server is required for the shared app copy.</p>
        <div className="sy-actions">
          <Link className="sy-btn primary" to="/install">Installation guide</Link>
          <Link className="sy-btn" to="/login">Open sign in</Link>
          <a className="sy-btn" href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">Get Python 3.11+</a>
        </div>
        <div className="sy-foot"><span>Syncora</span><span className="sy-dot" /><span>Plan, Manage, Connect</span></div>
      </section>
    </MarketingFrame>
  )
}
