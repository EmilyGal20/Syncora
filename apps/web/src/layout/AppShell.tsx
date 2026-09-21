import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import Campaign from '@mui/icons-material/Campaign'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline'
import CircleOutlined from '@mui/icons-material/CircleOutlined'
import Groups from '@mui/icons-material/Groups'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import HelpOutline from '@mui/icons-material/HelpOutline'
import MenuIcon from '@mui/icons-material/Menu'
import Search from '@mui/icons-material/Search'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import SpaceDashboard from '@mui/icons-material/SpaceDashboard'
import { AppBar, Avatar, Box, Divider, Drawer, IconButton, InputBase, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Select, Toolbar, Typography, useMediaQuery } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ElementType } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { SyncoraLogo } from '../components/SyncoraBrand'
import { NotificationCenter } from '../components/NotificationCenter'
import { RealtimeBridge } from '../components/RealtimeBridge'
import type { NavItem } from '../types'

const width=248
const iconMap:Record<string,ElementType>={Dashboard:SpaceDashboard,CheckCircle:CheckCircleOutline,CalendarMonth,Groups,Campaign,AdminPanelSettings,Folder:FolderOutlined,Circle:CircleOutlined}
interface Workspace{id:string;name:string;workspace_type:string;logo_url:string|null}

export function AppShell(){
  const mobile=useMediaQuery('(max-width:899px)')
  const [open,setOpen]=useState(false)
  const [profile,setProfile]=useState<HTMLElement|null>(null)
  const {user,logout,switchWorkspace}=useAuth();const queryClient=useQueryClient()
  const navigate=useNavigate()
  const location=useLocation()
  const {data=[]}=useQuery({queryKey:['navigation',user?.permissions],queryFn:async()=> (await api.get<NavItem[]>('/navigation')).data})
  const workspaces=useQuery({queryKey:['platform-workspaces'],enabled:!!user?.is_platform_admin,queryFn:async()=>(await api.get<Workspace[]>('/platform/workspaces')).data})
  const logo=useQuery({queryKey:['workspace-logo',user?.organization_id],enabled:!!user?.workspace_logo_url,queryFn:async()=>URL.createObjectURL((await api.get('/workspace/logo',{responseType:'blob'})).data)})
  const nav=<Box sx={{height:'100%',display:'flex',flexDirection:'column'}}>
    <Toolbar sx={{minHeight:'76px!important',justifyContent:'center',overflow:'hidden'}}><SyncoraLogo compact/></Toolbar>
    <Divider/><Box sx={{px:2,pt:2,pb:1,display:'flex',alignItems:'center',gap:1.25}}>{logo.data&&<Box component="img" src={logo.data} alt="Workspace logo" sx={{width:30,height:30,objectFit:'contain',borderRadius:1}}/>}<Box minWidth={0}><Typography variant="caption" color="text.secondary">{user?.workspace_type==='band'?'BAND WORKSPACE':'WORKSPACE'}</Typography><Typography noWrap fontWeight={700} fontSize={13}>{user?.workspace_name}</Typography></Box></Box>
    <List sx={{px:1}}>{data.map(item=>{const Icon=iconMap[item.icon]??CircleOutlined;return <ListItemButton key={item.id} selected={location.pathname===item.route} onClick={()=>{if(item.route)navigate(item.route);setOpen(false)}} sx={{minHeight:42,mb:.5}}><ListItemIcon sx={{minWidth:38}}><Icon fontSize="small"/></ListItemIcon><ListItemText primary={item.title} primaryTypographyProps={{fontSize:14,fontWeight:600}}/></ListItemButton>})}</List>
    <Box sx={{flex:1}}/><Divider/><List>{user?.is_platform_admin&&<ListItemButton onClick={()=>navigate('/platform')}><ListItemIcon sx={{minWidth:38}}><AdminPanelSettings fontSize="small"/></ListItemIcon><ListItemText primary="Platform administration"/></ListItemButton>}<ListItemButton onClick={()=>navigate('/settings')}><ListItemIcon sx={{minWidth:38}}><SettingsOutlined fontSize="small"/></ListItemIcon><ListItemText primary="Settings"/></ListItemButton></List>
  </Box>
  return <Box sx={{display:'flex',minHeight:'100vh'}}><RealtimeBridge/>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{borderBottom:1,borderColor:'divider',width:{md:`calc(100% - ${width}px)`},ml:{md:`${width}px`}}}><Toolbar sx={{gap:1}}>{mobile&&<IconButton aria-label="Open navigation" onClick={()=>setOpen(true)}><MenuIcon/></IconButton>}<Box sx={{display:{xs:'none',sm:'flex'},alignItems:'center',bgcolor:'background.default',borderRadius:1,px:1.5,width:{sm:220,lg:360},maxWidth:420}}><Search color="action"/><InputBase placeholder="Search Syncora" inputProps={{'aria-label':'Search Syncora'}} sx={{ml:1,flex:1}}/></Box>{user?.is_platform_admin&&<Select size="small" aria-label="Current workspace" value={user.organization_id} sx={{minWidth:{xs:130,sm:190},maxWidth:240}} onChange={async e=>{await switchWorkspace(e.target.value);queryClient.clear();navigate('/dashboard')}}>{workspaces.data?.map(w=><MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}</Select>}<Box sx={{flex:1}}/><IconButton aria-label="Contact support" onClick={()=>navigate('/support')}><HelpOutline/></IconButton><NotificationCenter/><IconButton aria-label="Profile menu" onClick={e=>setProfile(e.currentTarget)}><Avatar sx={{width:34,height:34,bgcolor:'primary.main',fontSize:14}}>{user?.full_name.split(' ').map(x=>x[0]).join('').slice(0,2)}</Avatar></IconButton><Menu anchorEl={profile} open={!!profile} onClose={()=>setProfile(null)}><MenuItem disabled>{user?.email??user?.username}</MenuItem><MenuItem onClick={()=>navigate('/settings')}>Preferences</MenuItem><MenuItem onClick={()=>void logout()}>Sign out</MenuItem></Menu></Toolbar></AppBar>
    <Box component="nav" aria-label="Primary navigation"><Drawer variant={mobile?'temporary':'permanent'} open={mobile?open:true} onClose={()=>setOpen(false)} ModalProps={{keepMounted:true}} sx={{'& .MuiDrawer-paper':{width,boxSizing:'border-box'}}}>{nav}</Drawer></Box>
    <Box component="main" sx={{flex:1,minWidth:0,ml:{md:`${width}px`},pt:'64px'}}><Box sx={{p:{xs:2,sm:3,lg:4},maxWidth:1600,mx:'auto'}}><Outlet/></Box></Box>
  </Box>
}
