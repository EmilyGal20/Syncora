import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import wordmark from '../assets/brand/syncora-wordmark.png'
import { InstallAppButton } from '../components/InstallAppButton'
import './marketing.css'

export function MarketingFrame({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return (
    <div className="sy-page">
      <main className="sy-site">
        <div className="sy-top">
          <Link to="/" aria-label="Syncora home">
            <img src={wordmark} alt="Syncora" />
          </Link>
          <nav className="sy-nav">
            <InstallAppButton />
            <Link to="/install">Guide</Link>
            {user ? <Link className="primary" to="/dashboard">Open workspace</Link> : <Link className="primary" to="/login">Sign in</Link>}
          </nav>
        </div>
        {children}
      </main>
    </div>
  )
}
