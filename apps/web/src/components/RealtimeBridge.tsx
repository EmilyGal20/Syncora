import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { playReminderChime } from '../lib/chime'

const invalidations:Record<string,string[][]>={
  'notification.created':[['notifications']], 'dashboard.assigned':[['dashboard']], 'dashboard.published':[['dashboard']],
  'permission.updated':[['navigation'],['dashboard']], 'task.created':[['tasks'],['dashboard']], 'task.updated':[['tasks'],['dashboard']],
  'task.deleted':[['tasks'],['dashboard']], 'show.created':[['band','shows'],['events'],['dashboard']],
  'show.updated':[['band','shows'],['events'],['dashboard']], 'rehearsal.updated':[['band','rehearsals'],['events'],['dashboard']],
  'file.created':[['files']], 'file.deleted':[['files']],
  'registration.created':[['access-requests']], 'registration.updated':[['access-requests']],
  'support.created':[['support']], 'support.message':[['support']], 'support.updated':[['support']],
  'note.created':[['notes']], 'note.updated':[['notes']], 'note.deleted':[['notes']],
  'event.created':[['events']], 'event.updated':[['events']], 'event.deleted':[['events']],
  'booking.created':[['bookings'],['notifications']], 'booking.updated':[['bookings'],['events'],['notifications']],
}
export function RealtimeBridge(){const {user,refreshUser}=useAuth();const client=useQueryClient();const userId=user?.id;const workspaceId=user?.organization_id;useEffect(()=>{if(!userId||!workspaceId)return;let socket:WebSocket|undefined;let closed=false;let attempt=0;let timer:number|undefined;const connect=()=>{const token=sessionStorage.getItem('syncora_access_token');if(!token||closed)return;const url=new URL('/api/v1/realtime',window.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(url,['syncora',token]);socket.onopen=()=>{if(closed){socket?.close(1000);return}attempt=0;socket?.send('ready')};socket.onmessage=event=>{const message=JSON.parse(event.data) as {type:string};for(const key of invalidations[message.type]??[])void client.invalidateQueries({queryKey:key});if(message.type==='permission.updated')void refreshUser();if(message.type==='booking.created')playReminderChime()};socket.onclose=()=>{if(!closed)timer=window.setTimeout(connect,Math.min(30_000,1000*2**attempt++))}};timer=window.setTimeout(connect,50);return()=>{closed=true;if(timer)clearTimeout(timer);if(!socket)return;socket.onmessage=null;socket.onerror=null;socket.onclose=null;if(socket.readyState===WebSocket.OPEN)socket.close(1000);else if(socket.readyState===WebSocket.CONNECTING)socket.onopen=()=>socket?.close(1000)}},[userId,workspaceId,client,refreshUser]);return null}
