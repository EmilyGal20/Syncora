import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import BarChart from '@mui/icons-material/BarChart'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import Campaign from '@mui/icons-material/Campaign'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline'
import CircleOutlined from '@mui/icons-material/CircleOutlined'
import Groups from '@mui/icons-material/Groups'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import HelpOutline from '@mui/icons-material/HelpOutline'
import NotesOutlined from '@mui/icons-material/NotesOutlined'
import Search from '@mui/icons-material/Search'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import SpaceDashboard from '@mui/icons-material/SpaceDashboard'
import ViewKanban from '@mui/icons-material/ViewKanban'
import { useTranslation } from 'react-i18next'
import { AppBar, Avatar, Box, Divider, Drawer, IconButton, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Select, Toolbar, Typography, useMediaQuery } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ElementType } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { SyncoraLogo } from '../components/SyncoraBrand'
import { MeetingReminder } from '../components/MeetingReminder'
import { InstallAppButton } from '../components/InstallAppButton'
import { NotificationCenter } from '../components/NotificationCenter'
import { RealtimeBridge } from '../components/RealtimeBridge'
import type { NavItem } from '../types'

const width=248
const iconMap:Record<string,ElementType>={Dashboard:SpaceDashboard,CheckCircle:CheckCircleOutline,CalendarMonth,Notes:NotesOutlined,Groups,Campaign,AdminPanelSettings,Folder:FolderOutlined,Circle:CircleOutlined,ViewKanban,BarChart,AutoAwesome}
const engineRoutes=[
  {route:'/flow/dashboard',titleKey:'engine.dashboard',icon:SpaceDashboard,permission:'engine.dashboard'},
  {route:'/flow/tasks',titleKey:'engine.tasks',icon:CheckCircleOutline,permission:'engine.tasks'},
  {route:'/flow/board',titleKey:'engine.board',icon:ViewKanban,permission:'engine.board'},
  {route:'/flow/projects',titleKey:'engine.projects',icon:FolderOutlined,permission:'engine.projects'},
  {route:'/flow/calendar',titleKey:'engine.calendar',icon:CalendarMonth,permission:'engine.calendar'},
  {route:'/flow/analytics',titleKey:'engine.analytics',icon:BarChart,permission:'engine.analytics'},
  {route:'/flow/planner',titleKey:'engine.planner',icon:AutoAwesome,permission:'engine.planner'},
] as const
interface Workspace{id:string;name:string;workspace_type:string;logo_url:string|null}

export function AppShell(){
  const {t}=useTranslation()
  const mobile=useMediaQuery('(max-width:899px)')
  const [open,setOpen]=useState(()=>typeof window==='undefined'||window.innerWidth>=900)
  const [profile,setProfile]=useState<HTMLElement|null>(null)
  const {user,logout,switchWorkspace,can}=useAuth();const queryClient=useQueryClient()
  const navigate=useNavigate()
  const location=useLocation()
  const {data=[]}=useQuery({queryKey:['navigation',user?.permissions],queryFn:async()=> (await api.get<NavItem[]>('/navigation')).data})
  const workspaces=useQuery({queryKey:['platform-workspaces'],enabled:!!user?.is_platform_admin,queryFn:async()=>(await api.get<Workspace[]>('/platform/workspaces')).data,retry:(count,error)=>{const status=(error as {response?:{status?:number}}).response?.status;return status&&status>=400&&status<500?false:count<2}})
  const workspaceOptions=workspaces.data??[]
  const selectedWorkspace=workspaceOptions.some(workspace=>workspace.id===user?.organization_id)?user?.organization_id??'':''
  const logo=useQuery({queryKey:['workspace-logo',user?.organization_id],enabled:!!user?.workspace_logo_url,queryFn:async()=>URL.createObjectURL((await api.get('/workspace/logo',{responseType:'blob'})).data)})
  const nav=<Box sx={{height:'100%',display:'flex',flexDirection:'column'}}>
    <Box sx={{px:2,pt:2,pb:1,display:'flex',alignItems:'center',gap:1.25}}>{logo.data&&<Box component="img" src={logo.data} alt="Workspace logo" sx={{width:30,height:30,objectFit:'contain',borderRadius:1}}/>}<Box minWidth={0}><Typography variant="caption" color="text.secondary">{user?.workspace_type==='band'?'BAND WORKSPACE':'WORKSPACE'}</Typography><Typography noWrap fontWeight={700} fontSize={13}>{user?.workspace_name}</Typography></Box></Box>
    <List sx={{px:1}}>{data.filter(item=>item.route!=='/admin').map(item=>{const Icon=iconMap[item.icon]??CircleOutlined;const selected=item.route?location.pathname===item.route||location.pathname.startsWith(`${item.route}/`):false;return <ListItemButton key={item.id} selected={selected} onClick={()=>{if(item.route)navigate(item.route);setOpen(false)}} sx={{minHeight:42,mb:.5}}><ListItemIcon sx={{minWidth:38}}><Icon fontSize="small"/></ListItemIcon><ListItemText primary={item.title} primaryTypographyProps={{fontSize:14,fontWeight:600}}/></ListItemButton>})}</List>
    {engineRoutes.some(item=>can(item.permission)||can('tasks.view'))&&<><Typography variant="caption" color="text.secondary" sx={{px:2,pt:1,pb:.5,display:'block',fontWeight:700,letterSpacing:.6}}>{t('engine.section')}</Typography>
    <List sx={{px:1}}>{engineRoutes.filter(item=>!data.some(existing=>existing.route===item.route)&&(can(item.permission)||(!(user?.permissions??[]).some(code=>code.startsWith('engine.'))&&can('tasks.view')))).map(item=>{const selected=location.pathname===item.route||location.pathname.startsWith(`${item.route}/`);const Icon=item.icon;return <ListItemButton key={item.route} selected={selected} onClick={()=>{navigate(item.route);setOpen(false)}} sx={{minHeight:42,mb:.5}}><ListItemIcon sx={{minWidth:38}}><Icon fontSize="small"/></ListItemIcon><ListItemText primary={t(item.titleKey)} primaryTypographyProps={{fontSize:14,fontWeight:600}}/></ListItemButton>})}</List></>}
    <Box sx={{flex:1}}/><Divider/><List>{user?.is_platform_admin&&<ListItemButton selected={location.pathname==='/platform'} onClick={()=>navigate('/platform')}><ListItemIcon sx={{minWidth:38}}><AdminPanelSettings fontSize="small"/></ListItemIcon><ListItemText primary="Platform administration"/></ListItemButton>}<ListItemButton selected={location.pathname==='/settings'} onClick={()=>navigate('/settings')}><ListItemIcon sx={{minWidth:38}}><SettingsOutlined fontSize="small"/></ListItemIcon><ListItemText primary={t('nav.settings')}/></ListItemButton></List>
  </Box>
  const barHeight={xs:56,sm:64}
  return <Box sx={{display:'flex',minHeight:'100dvh'}}><RealtimeBridge/><MeetingReminder/>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{borderBottom:1,borderColor:'divider',zIndex:theme=>theme.zIndex.drawer+1,pt:'env(safe-area-inset-top)'}}><Toolbar sx={{gap:{xs:0.75,sm:1.5},minHeight:{xs:'56px!important',sm:'64px!important'},px:{xs:1,sm:2},pl:{xs:'max(8px, env(safe-area-inset-left))',sm:2},pr:{xs:'max(8px, env(safe-area-inset-right))',sm:2}}}><Box component="button" type="button" onClick={()=>setOpen(value=>!value)} aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} sx={{display:'flex',alignItems:'center',border:0,background:'none',p:0,cursor:'pointer',flexShrink:0}}><SyncoraLogo compact/></Box><Box sx={{display:{xs:'none',md:'flex'},alignItems:'center',bgcolor:'background.default',borderRadius:1,px:1.5,width:{md:220,lg:360,xl:440},maxWidth:520,flexShrink:1}}><Search color="action"/><InputBase placeholder="Search Syncora" inputProps={{'aria-label':'Search Syncora'}} sx={{ml:1,flex:1}}/></Box>{user?.is_platform_admin&&<Select size="small" inputProps={{'aria-label':'Current workspace'}} value={selectedWorkspace} displayEmpty disabled={workspaces.isLoading||workspaces.isError||!selectedWorkspace} sx={{minWidth:{xs:0,sm:140,md:190},maxWidth:{xs:110,sm:200,md:240},display:{xs:'none',sm:'inline-flex'}}} renderValue={value=>value?workspaceOptions.find(workspace=>workspace.id===value)?.name??user.workspace_name:workspaces.isError?'Workspaces unavailable':user.workspace_name} onChange={async e=>{if(!e.target.value)return;await switchWorkspace(e.target.value);queryClient.clear();navigate('/dashboard')}}><MenuItem value="" disabled>{user.workspace_name}</MenuItem>{workspaceOptions.map(w=><MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}</Select>}<Box sx={{flex:1,minWidth:8}}/><InstallAppButton compact/><IconButton aria-label="Contact support" onClick={()=>navigate('/support')} sx={{display:{xs:'none',sm:'inline-flex'}}}><HelpOutline/></IconButton><NotificationCenter/><IconButton aria-label="Profile menu" onClick={e=>setProfile(e.currentTarget)}><Avatar sx={{width:{xs:30,sm:34},height:{xs:30,sm:34},bgcolor:'primary.main',fontSize:14}}>{user?.full_name.split(' ').map(x=>x[0]).join('').slice(0,2)}</Avatar></IconButton><Menu anchorEl={profile} open={!!profile} onClose={()=>setProfile(null)}><MenuItem disabled>{user?.email??user?.username}</MenuItem><MenuItem onClick={()=>{setProfile(null);navigate('/settings?panel=profile')}}>{t('settings.profile')}</MenuItem><MenuItem onClick={()=>void logout()}>Sign out</MenuItem></Menu></Toolbar></AppBar>
    <Box component="nav" aria-label="Primary navigation"><Drawer variant={mobile?'temporary':'persistent'} open={open} onClose={()=>setOpen(false)} ModalProps={{keepMounted:true}} sx={{'& .MuiDrawer-paper':{width:{xs:'min(248px, 86vw)',sm:width},boxSizing:'border-box',top:{xs:0,md:64},height:{xs:'100dvh',md:'calc(100% - 64px)'},pt:{xs:'env(safe-area-inset-top)',md:0},borderRight:1,borderColor:'divider'}}}>{nav}</Drawer></Box>
    <Box component="main" sx={{flex:1,minWidth:0,pt:{xs:`calc(${barHeight.xs}px + env(safe-area-inset-top))`,sm:`calc(${barHeight.sm}px + env(safe-area-inset-top))`},pb:'env(safe-area-inset-bottom)',ml:{md:open?`${width}px`:0},transition:theme=>theme.transitions.create('margin',{duration:theme.transitions.duration.enteringScreen})}}><Box sx={location.pathname.startsWith('/flow')?{p:0,maxWidth:'none'}:{p:{xs:1.5,sm:3,lg:4,xl:5},maxWidth:{xs:'100%',lg:1440,xl:1800},mx:'auto',width:'100%'}}><Outlet/></Box></Box>
  </Box>
}
