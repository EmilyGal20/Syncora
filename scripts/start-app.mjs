import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'

const windows = process.platform === 'win32'
const python = existsSync(windows ? '.venv\\Scripts\\python.exe' : '.venv/bin/python')
  ? (windows ? '.venv\\Scripts\\python.exe' : '.venv/bin/python')
  : 'python'
const dist = 'apps/web/dist/index.html'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true, cwd: process.cwd(), env: process.env, shell: windows && command === 'npm' })
  if (result.status) process.exit(result.status)
}

if (!existsSync(dist)) {
  console.log('Building Syncora UI once...')
  run(windows ? 'cmd.exe' : 'npm', windows ? ['/c', 'npm --prefix apps/web run build'] : ['--prefix', 'apps/web', 'run', 'build'])
}

if (!existsSync(windows ? '.venv\\Scripts\\python.exe' : '.venv/bin/python')) {
  console.log('Python venv is missing. Create it once with: python -m venv .venv')
  console.log('Then: .venv\\Scripts\\python.exe -m pip install -r apps\\api\\requirements.txt')
  process.exit(1)
}

const hasWebview = spawnSync(python, ['-c', 'import webview'], { windowsHide: true })
if (hasWebview.status) spawnSync(python, ['-m', 'pip', 'install', '-q', 'pywebview'], { stdio: 'inherit', windowsHide: true })

const child = spawn(python, ['apps/desktop/launch.py'], { stdio: 'inherit', windowsHide: false, cwd: process.cwd(), env: process.env })
child.on('exit', (code) => process.exit(code ?? 0))
