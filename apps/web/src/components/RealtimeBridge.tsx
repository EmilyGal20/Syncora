import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'

const invalidations:Record<string,string[][]>={
  'notification.created':[['notifications']], 'dashboard.assigned':[['dashboard']], 'dashboard.published':[['dashboard']],
  'permission.updated':[['navigation'],['dashboard']], 'task.created':[['tasks'],['dashboard']], 'task.updated':[['tasks'],['dashboard']],
  'task.deleted':[['tasks'],['dashboard']], 'show.created':[['band','shows'],['events'],['dashboard']],
  'show.updated':[['band','shows'],['events'],['dashboard']], 'rehearsal.updated':[['band','rehearsals'],['events'],['dashboard']],
  'file.created':[['files']], 'file.deleted':[['files']],
  'registration.created':[['access-requests']], 'registration.updated':[['access-requests']],
  'support.created':[['support']], 'support.message':[['support']], 'support.updated':[['support']],
}
export function RealtimeBridge(){const {user,refreshUser}=useAuth();const client=useQueryClient();useEffect(()=>{if(!user)return;let socket:WebSocket|undefined;let closed=false;let attempt=0;let timer:number|undefined;const connect=()=>{const token=sessionStorage.getItem('syncora_access_token');if(!token||closed)return;const url=new URL('/api/v1/realtime',window.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(url,['syncora',token]);socket.onopen=()=>{attempt=0;socket?.send('ready')};socket.onmessage=event=>{const message=JSON.parse(event.data) as {type:string};for(const key of invalidations[message.type]??[])void client.invalidateQueries({queryKey:key});if(message.type==='permission.updated')void refreshUser()};socket.onclose=()=>{if(!closed)timer=window.setTimeout(connect,Math.min(30_000,1000*2**attempt++))}};connect();return()=>{closed=true;if(timer)clearTimeout(timer);socket?.close()}},[user,client,refreshUser]);return null}
