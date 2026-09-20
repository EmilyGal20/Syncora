import { spawn, spawnSync } from 'node:child_process'

const mode=process.argv[2]??'all'
const windows=process.platform==='win32'
const commands={
  frontend:windows?[process.env.ComSpec??'cmd.exe',['/d','/s','/c','npm --prefix apps/web run dev']]:['npm',['--prefix','apps/web','run','dev']],
  api:[windows?'.venv\\Scripts\\python.exe':'.venv/bin/python',['-m','uvicorn','app.main:app','--reload','--host','0.0.0.0','--port','8500','--app-dir','apps/api']],
  audit:['dotnet',['run','--project','apps/services/Syncora.Audit/Syncora.Audit.csproj','--','--environment','Development','--urls','http://0.0.0.0:8501']],
}
const selected=mode==='frontend'?['frontend']:mode==='backend'?['api','audit']:['frontend','api','audit']
const children=[]
let stopping=false

function stopTree(child){
  if(!child.pid)return
  if(windows)spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true})
  else child.kill('SIGTERM')
}

function shutdown(code=0){
  if(stopping)return
  stopping=true
  for(const child of children)stopTree(child)
  process.exitCode=code
}

for(const name of selected){
  const [command,args]=commands[name]
  const child=spawn(command,args,{cwd:process.cwd(),env:process.env,stdio:'inherit',windowsHide:true})
  children.push(child)
  child.on('error',error=>{console.error(`[${name}] ${error.message}`);shutdown(1)})
  child.on('exit',code=>{if(!stopping&&code!==0){console.error(`[${name}] exited with code ${code}`);shutdown(code??1)}})
}

process.on('SIGINT',()=>shutdown(0))
process.on('SIGTERM',()=>shutdown(0))
process.on('exit',()=>{for(const child of children)stopTree(child)})
