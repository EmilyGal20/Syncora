import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline'
import NotificationsNone from '@mui/icons-material/NotificationsNone'
import { Badge, Box, Button, Divider, Drawer, IconButton, List, ListItemButton, ListItemText, Tab, Tabs, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export interface NotificationItem {id:string;type:string;title:string;message:string;route:string|null;read_at:string|null;created_at:string}
interface NotificationPage {items:NotificationItem[];total:number;unread:number}

export function NotificationCenter(){
  const [open,setOpen]=useState(false);const [unreadOnly,setUnreadOnly]=useState(false);const navigate=useNavigate();const qc=useQueryClient()
  const query=useQuery({queryKey:['notifications',unreadOnly],queryFn:async()=>(await api.get<NotificationPage>('/notifications',{params:{unread:unreadOnly}})).data,refetchInterval:60_000})
  const mark=useMutation({mutationFn:(id:string)=>api.patch(`/notifications/${id}/read`),onSuccess:()=>qc.invalidateQueries({queryKey:['notifications']})})
  const markAll=useMutation({mutationFn:()=>api.post('/notifications/read-all'),onSuccess:()=>qc.invalidateQueries({queryKey:['notifications']})})
  const openItem=(item:NotificationItem)=>{if(!item.read_at)mark.mutate(item.id);if(item.route){navigate(item.route);setOpen(false)}}
  return <><IconButton aria-label="Notifications" onClick={()=>setOpen(true)}><Badge badgeContent={query.data?.unread??0} color="secondary" max={99}><NotificationsNone/></Badge></IconButton><Drawer anchor="right" open={open} onClose={()=>setOpen(false)} PaperProps={{sx:{width:{xs:'100%',sm:400},maxWidth:'100%'}}}><Box sx={{p:2,display:'flex',alignItems:'center',gap:1}}><Box flex={1}><Typography variant="h6">Notifications</Typography><Typography variant="caption" color="text.secondary">{query.data?.unread??0} unread</Typography></Box><Button size="small" startIcon={<CheckCircleOutline/>} disabled={!query.data?.unread} onClick={()=>markAll.mutate()}>Mark all read</Button></Box><Tabs value={unreadOnly?1:0} onChange={(_,value)=>setUnreadOnly(value===1)}><Tab label="All"/><Tab label="Unread"/></Tabs><Divider/><List disablePadding>{query.data?.items.map(item=><ListItemButton key={item.id} onClick={()=>openItem(item)} sx={{alignItems:'flex-start',py:1.5,bgcolor:item.read_at?'transparent':'action.selected'}}><ListItemText primary={item.title} secondary={<>{item.message&&<Typography component="span" variant="body2" display="block">{item.message}</Typography>}<Typography component="span" variant="caption" color="text.secondary">{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))}</Typography></>} primaryTypographyProps={{fontWeight:item.read_at?500:750}}/></ListItemButton>)}</List>{!query.isLoading&&!query.data?.items.length&&<Box sx={{p:4,textAlign:'center',color:'text.secondary'}}>You are all caught up.</Box>}</Drawer></>
}
