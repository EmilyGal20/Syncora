import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const web = path.join(root, 'apps', 'web', 'src')

function lanIp() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address
    }
  }
  return '127.0.0.1'
}

function png(name) {
  const file = path.join(web, 'assets', 'landing', name)
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`
}

const port = process.env.SYNCORA_WEB_PORT || '8600'
const origin = `http://${lanIp()}:${port}`
const wordmark = `data:image/png;base64,${fs.readFileSync(path.join(web, 'assets', 'brand', 'syncora-wordmark.png')).toString('base64')}`
const icon = `data:image/png;base64,${fs.readFileSync(path.join(root, 'apps', 'web', 'public', 'logos', 'syncora-mark.png')).toString('base64')}`
const css = fs.readFileSync(path.join(web, 'pages', 'landing.css'), 'utf8')
const shots = {
  dashboard: png('dashboard.png'),
  board: png('board.png'),
  projects: png('projects.png'),
  schedule: png('schedule.png'),
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Syncora · Plan, Manage, Connect</title>
  <meta name="description" content="Open this file to install Syncora and sign in. Nothing else to download." />
  <meta name="theme-color" content="#101C3D" />
  <link rel="icon" type="image/png" href="${icon}" />
  <style>
${css}
  </style>
</head>
<body>
  <div class="lp">
    <header class="lp-bar">
      <div class="lp-wrap lp-bar-inner">
        <a class="lp-brand" href="#intro" aria-label="Syncora home"><img src="${wordmark}" alt="Syncora" /></a>
        <nav class="lp-nav" aria-label="Landing">
          <a class="lp-btn" data-path="/install">Install the app</a>
          <a class="lp-btn primary" data-path="/login">Sign in</a>
        </nav>
      </div>
    </header>
    <main>
      <section class="lp-hero" id="intro">
        <div class="lp-wrap lp-hero-grid">
          <div class="lp-copy">
            <p class="lp-kicker">Plan · Manage · Connect</p>
            <h1>Plan, manage, and connect the workspace</h1>
            <p class="lp-lead">Syncora is the operating layer for daily work: tasks, calendars, teams, files, notes, and booking. Share this file. The links below install the app and open the workspace.</p>
            <ul class="lp-pills">
              <li>Tasks</li><li>Schedule</li><li>Projects</li><li>Booking</li><li>Files</li><li>Notes</li>
            </ul>
          </div>
          <div class="lp-stage">
            <img class="lp-shot" src="${shots.dashboard}" alt="Syncora dashboard with open tasks, announcements, and the task engine" />
          </div>
        </div>
      </section>
      <section class="lp-block" id="product">
        <div class="lp-wrap">
          <div class="lp-intro">
            <p class="lp-kicker">Product</p>
            <h2>What you run in Syncora</h2>
            <p>One branded workspace. People see the pages and actions meant for them.</p>
          </div>
          <ul class="lp-grid">
            <li><h3>Workspaces</h3><p>Each organization gets its own workspace, roles, and branding.</p></li>
            <li><h3>Task engine</h3><p>Priorities, boards, projects, and progress in one working flow.</p></li>
            <li><h3>Schedule</h3><p>Calendar, meetings, and guest booking links without another tool.</p></li>
            <li><h3>Projects</h3><p>Group related work and follow progress with the rest of the team.</p></li>
            <li><h3>Files and notes</h3><p>Shared files and private or team notes stay with the workspace.</p></li>
            <li><h3>Any device</h3><p>The same app on a computer and on a phone, installed from the browser.</p></li>
          </ul>
        </div>
      </section>
      <section class="lp-block lp-muted" id="views">
        <div class="lp-wrap">
          <div class="lp-intro">
            <p class="lp-kicker">Product surfaces</p>
            <h2>From dashboard to delivery</h2>
            <p>The same installed app on a large monitor, a laptop, or a phone home screen.</p>
          </div>
          <div class="lp-mosaic">
            <article class="is-wide">
              <img class="lp-shot" src="${shots.board}" alt="Syncora task board with To Do, In Progress, and Completed columns" />
              <h3>Task board</h3>
              <p>Priorities, projects, and progress on one board.</p>
            </article>
            <article>
              <img class="lp-shot" src="${shots.projects}" alt="Syncora projects with progress for each project" />
              <h3>Projects</h3>
              <p>Group related work and follow progress in the workspace.</p>
            </article>
            <article>
              <img class="lp-shot" src="${shots.schedule}" alt="Syncora monthly schedule with booking actions" />
              <h3>Schedule and booking</h3>
              <p>Internal calendar plus guest meeting links.</p>
            </article>
          </div>
        </div>
      </section>
      <section class="lp-block" id="install">
        <div class="lp-wrap">
          <div class="lp-intro">
            <p class="lp-kicker">Install</p>
            <h2>A web app, installed directly</h2>
            <p>Syncora installs from the browser onto a computer or a phone. Nothing else to download, and no extra software to set up.</p>
          </div>
          <div class="lp-devices">
            <article>
              <h3>Computer</h3>
              <p>Chrome or Edge installs Syncora onto the computer. It then opens in its own window.</p>
              <ol>
                <li>Choose Install the app on this page.</li>
                <li>On the Syncora page, choose Install app.</li>
                <li>Launch it from the desktop, Dock, or Start menu, then sign in.</li>
              </ol>
            </article>
            <article>
              <h3>Phone</h3>
              <p>The same address becomes a home-screen app. There is no store and no extra download.</p>
              <ol>
                <li>Choose Install the app, and open that page in Safari or Chrome.</li>
                <li>iPhone: Share, then Add to Home Screen.</li>
                <li>Android: browser menu, then Install app. Then sign in.</li>
              </ol>
            </article>
          </div>
          <div class="lp-install-bar">
            <div>
              <h2>Install it, then sign in</h2>
              <p>These links open the live Syncora workspace. Install the web app there, then sign in and work as usual.</p>
            </div>
            <div class="lp-actions">
              <a class="lp-btn primary" data-path="/install">Install the app</a>
              <a class="lp-btn light" data-path="/login">Sign in</a>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer class="lp-foot">
      <div class="lp-wrap lp-foot-inner">
        <span>Syncora</span>
        <span class="lp-dot"></span>
        <span>Plan, Manage, Connect</span>
        <nav>
          <a data-path="/install">Install</a>
          <a data-path="/login">Sign in</a>
        </nav>
      </div>
    </footer>
  </div>
  <script>
    const syncoraOrigin = ${JSON.stringify(origin)};
    document.querySelectorAll("[data-path]").forEach((link) => {
      link.href = syncoraOrigin + link.getAttribute("data-path");
    });
  </script>
</body>
</html>
`

const out = path.join(root, 'Syncora.html')
fs.writeFileSync(out, html)
console.log(out)
console.log(origin)
