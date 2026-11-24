import {spawn,spawnSync} from 'node:child_process'
import {watch} from 'node:fs'
import path from 'node:path'

const mode=process.argv[2]??'all'
const windows=process.platform==='win32'
const root=process.cwd()
const commands={
  frontend:windows?[process.env.ComSpec??'cmd.exe',['/d','/s','/c','npm --prefix apps/web run dev']]:['npm',['--prefix','apps/web','run','dev']],
  audit:['dotnet',['run','--project','apps/services/Syncora.Audit/Syncora.Audit.csproj','--','--environment','Development','--urls','http://0.0.0.0:8501']],
}
const selected=mode==='frontend'?['frontend']:mode==='api'?['api']:mode==='backend'?['api','audit']:['frontend','api','audit']
const children=[]
let stopping=false
let apiChild=null
let apiRestarting=false
let reloadTimer=null
let pendingReload=false

function apiCommand(){
  const python=windows?'.venv\\Scripts\\python.exe':'.venv/bin/python'
  const args=['-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8500','--app-dir','apps/api']
  // uvicorn --reload sends CTRL_C_EVENT, which Windows delivers to every process in the console.
  if(!windows)args.push('--reload','--reload-dir','apps/api')
  return [python,args]
}

function stopTree(child){
  if(!child?.pid)return
  if(windows)spawnSync('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true})
  else child.kill('SIGTERM')
}

function shutdown(code=0){
  if(stopping)return
  stopping=true
  clearTimeout(reloadTimer)
  for(const child of children)stopTree(child)
  process.exitCode=code
}

function track(name,child){
  children.push(child)
  child.on('error',error=>{console.error(`[${name}] ${error.message}`);shutdown(1)})
  child.on('exit',code=>{
    const index=children.indexOf(child)
    if(index>=0)children.splice(index,1)
    if(stopping||(name==='api'&&apiRestarting))return
    if(code!==0&&code!==null){console.error(`[${name}] exited with code ${code}`);shutdown(code??1)}
  })
}

function start(name){
  const [command,args]=name==='api'?apiCommand():commands[name]
  const child=spawn(command,args,{cwd:root,env:process.env,stdio:'inherit',windowsHide:true})
  if(name==='api')apiChild=child
  track(name,child)
  return child
}

function restartApi(filename){
  if(stopping)return
  if(apiRestarting){pendingReload=true;return}
  const previous=apiChild
  if(!previous||previous.exitCode!==null){start('api');return}
  apiRestarting=true
  console.log(`[api] ${filename} changed, reloading`)
  stopTree(previous)
  const relaunch=()=>{
    apiRestarting=false
    if(stopping)return
    start('api')
    if(pendingReload){pendingReload=false;scheduleReload(filename)}
  }
  if(previous.exitCode!==null)relaunch()
  else previous.once('exit',relaunch)
}

function scheduleReload(filename){
  clearTimeout(reloadTimer)
  reloadTimer=setTimeout(()=>restartApi(filename),400)
}

for(const name of selected)start(name)

if(windows&&selected.includes('api')){
  watch(path.join(root,'apps','api'),{recursive:true},(_event,filename)=>{
    const rel=String(filename??'')
    if(!rel.endsWith('.py')||rel.includes('__pycache__'))return
    scheduleReload(rel)
  })
}

process.on('SIGINT',()=>shutdown(0))
process.on('SIGTERM',()=>shutdown(0))
process.on('exit',()=>{for(const child of children)stopTree(child)})
