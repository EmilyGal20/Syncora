import { Link } from 'react-router-dom'
import { InstallAppButton } from '../components/InstallAppButton'
import { MarketingFrame } from '../marketing/MarketingFrame'

export function InstallPage() {
  return (
    <MarketingFrame>
      <section className="sy-section sy-hero" id="top">
        <h1>Install and use Syncora</h1>
        <p className="sy-lead">One product, three ways in: the Windows app, a phone icon on the same Wi-Fi, or localhost while you develop. Pick the path that matches the device.</p>
        <div className="sy-actions">
          <InstallAppButton />
          <a className="sy-btn" href="#windows">Windows folder</a>
          <a className="sy-btn" href="#phone">iPhone / Android</a>
          <Link className="sy-btn" to="/login">Sign in</Link>
        </div>
      </section>
      <section className="sy-section" id="webapp">
        <h2>Install as a web app</h2>
        <div className="sy-steps">
          <article className="sy-step">
            <h3>Desktop or phone</h3>
            <p>Open Syncora in Chrome, Edge, or Safari. Tap <strong>Install app</strong> in the header. After that, launch Syncora from the desktop, the Start menu, or the phone home screen — no extra files and no terminal.</p>
            <div className="sy-actions"><InstallAppButton /></div>
          </article>
        </div>
      </section>
      <section className="sy-section" id="windows">
        <h2>Windows computer</h2>
        <div className="sy-steps">
          <article className="sy-step">
            <h3>1. Get the Syncora folder</h3>
            <p>Receive the shared project folder (zip is fine). Do not include a development <code>.env</code> file — that would point the copy at someone else’s database.</p>
          </article>
          <article className="sy-step">
            <h3>2. Open the app file</h3>
            <p>Double-click this file in the folder you received:</p>
            <code className="sy-code">Open-Syncora.cmd</code>
            <p style={{ marginTop: 8 }}>Same action: <code>Start-Syncora.cmd</code> or <code>npm run app</code>.</p>
          </article>
          <article className="sy-step">
            <h3>3. First launch</h3>
            <p>If Python 3.11+ is missing, install it from the official site, then open the file again. The first run may create a local environment. After that, Syncora opens in its own window.</p>
            <a className="sy-link" href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">Download Python 3.11+</a>
          </article>
          <article className="sy-step">
            <h3>4. Sign in</h3>
            <p>Demo workspace (until you create your own users):</p>
            <code className="sy-code">admin@syncora.dev</code>
            <code className="sy-code">ChangeMe123!</code>
            <p style={{ marginTop: 8 }}>Data stays on that computer under <code>%LOCALAPPDATA%\Syncora</code>. No Docker, Postgres, Mongo, or hosted server.</p>
            <Link className="sy-link" to="/login">Open the sign-in page</Link>
          </article>
        </div>
      </section>
      <section className="sy-section" id="phone">
        <h2>iPhone and Android</h2>
        <div className="sy-steps">
          <article className="sy-step">
            <h3>Install as a home-screen app</h3>
            <p>The Windows <code>.cmd</code> file cannot be installed on a phone. Keep the Windows app open, stay on the same Wi-Fi, then pin Syncora like an app.</p>
            <ol>
              <li>On the computer, leave <code>Open-Syncora.cmd</code> running.</li>
              <li>Open <code>%LOCALAPPDATA%\Syncora\phone-url.txt</code> and copy the “On your phone” address.</li>
              <li>Open that address in Safari (iPhone) or Chrome (Android).</li>
              <li>iPhone: Share → Add to Home Screen. Android: menu → Add to Home screen / Install app.</li>
            </ol>
            <p>Allow Python through Windows Firewall on a private network the first time.</p>
          </article>
        </div>
      </section>
      <section className="sy-section" id="develop">
        <h2>Development on this machine</h2>
        <div className="sy-steps">
          <article className="sy-step">
            <h3>Localhost</h3>
            <p>Run both processes so the UI and API stay in sync:</p>
            <code className="sy-code">npm run frontend</code>
            <code className="sy-code">npm run backend</code>
            <p style={{ marginTop: 8 }}>Then open <a className="sy-link" href="http://localhost:8600/login">http://localhost:8600/login</a>. If only the frontend is running, sign-in cannot work.</p>
          </article>
          <article className="sy-step">
            <h3>Another device on the LAN</h3>
            <p>Keep frontend and backend running, then on the other device open <code>http://YOUR-PC-IP:8600</code>.</p>
          </article>
        </div>
      </section>
      <section className="sy-section sy-close">
        <h2>Need the product, not the setup?</h2>
        <div className="sy-actions">
          <Link className="sy-btn primary" to="/login">Sign in to Syncora</Link>
          <Link className="sy-btn" to="/">Back to Syncora</Link>
          <a className="sy-btn" href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">Python downloads</a>
        </div>
        <div className="sy-foot"><span>Syncora</span><span className="sy-dot" /><span>Plan, Manage, Connect</span></div>
      </section>
    </MarketingFrame>
  )
}
