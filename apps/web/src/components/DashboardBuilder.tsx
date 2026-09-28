import Add from '@mui/icons-material/Add'
import ContentCopy from '@mui/icons-material/ContentCopy'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import DragIndicator from '@mui/icons-material/DragIndicator'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

interface Summary{id:string;name:string;status:string;is_default:boolean}
interface Widget{id:string;type:string;title:string;position:number;width:number;height:number;required_permission?:string|null;configuration:Record<string,unknown>}
interface Dashboard extends Summary{widgets:Widget[]}
interface Assignment{id:string;principal_type:'organization'|'role'|'team'|'user';principal_id:string}
interface Option{id:string;name?:string;full_name?:string;email?:string}
const widgetTypes=['kpi','task_summary','schedule','announcements','pinned_notes','next_show','next_rehearsal','current_setlist','availability','equipment']

function SortableWidget({widget,onChange,onDelete}:{widget:Widget;onChange:(value:Widget)=>void;onDelete:()=>void}){
  const sortable=useSortable({id:widget.id})
  return <Paper ref={sortable.setNodeRef} style={{transform:CSS.Transform.toString(sortable.transform),transition:sortable.transition}} variant="outlined" sx={{p:1.5}}><Stack direction={{xs:'column',sm:'row'}} gap={1} alignItems={{sm:'center'}}>
    <IconButton {...sortable.attributes} {...sortable.listeners} aria-label={`Move ${widget.title}`}><DragIndicator/></IconButton>
    <TextField size="small" label="Widget title" value={widget.title} onChange={event=>onChange({...widget,title:event.target.value})}/>
    <TextField size="small" select label="Type" value={widget.type} onChange={event=>onChange({...widget,type:event.target.value})}>{widgetTypes.map(type=><MenuItem key={type} value={type}>{type.replaceAll('_',' ')}</MenuItem>)}</TextField>
    <TextField size="small" type="number" label="Width" value={widget.width} inputProps={{min:1,max:12}} onChange={event=>onChange({...widget,width:Math.max(1,Math.min(12,Number(event.target.value)))})}/>
    <TextField size="small" type="number" label="Height" value={widget.height} inputProps={{min:1,max:8}} onChange={event=>onChange({...widget,height:Math.max(1,Math.min(8,Number(event.target.value)))})}/>
    <TextField size="small" label="Required permission" value={widget.required_permission??''} onChange={event=>onChange({...widget,required_permission:event.target.value||null})}/>
    <IconButton color="error" aria-label={`Remove ${widget.title}`} onClick={onDelete}><DeleteOutline/></IconButton>
  </Stack></Paper>
}

export function DashboardBuilder(){
  const {can}=useAuth();const client=useQueryClient()
  const [selected,setSelected]=useState('');const [draft,setDraft]=useState<Dashboard|null>(null);const [createOpen,setCreateOpen]=useState(false);const [name,setName]=useState('')
  const [assignmentType,setAssignmentType]=useState<Assignment['principal_type']>('organization');const [principalId,setPrincipalId]=useState('')
  const list=useQuery({queryKey:['admin-dashboards'],queryFn:async()=>(await api.get<Summary[]>('/dashboards')).data})
  const detail=useQuery({queryKey:['admin-dashboard',selected],enabled:!!selected,queryFn:async()=>(await api.get<Dashboard>(`/dashboards/${selected}`)).data})
  const assignments=useQuery({queryKey:['dashboard-assignments',selected],enabled:!!selected&&can('dashboards.assign'),queryFn:async()=>(await api.get<Assignment[]>(`/dashboards/${selected}/assignments`)).data})
  const roles=useQuery({queryKey:['dashboard-role-options'],enabled:assignmentType==='role',queryFn:async()=>(await api.get<Option[]>('/roles')).data})
  const teams=useQuery({queryKey:['dashboard-team-options'],enabled:assignmentType==='team',queryFn:async()=>(await api.get<Option[]>('/teams')).data})
  const users=useQuery({queryKey:['dashboard-user-options'],enabled:assignmentType==='user',queryFn:async()=>(await api.get<{items:Option[]}>('/users',{params:{page_size:100}})).data.items})
  useEffect(()=>{if(detail.data)setDraft(detail.data)},[detail.data])
  const create=useMutation({mutationFn:()=>api.post<Summary>('/dashboards',{name,status:'draft',widgets:[]}),onSuccess:response=>{setCreateOpen(false);setName('');setSelected(response.data.id);void client.invalidateQueries({queryKey:['admin-dashboards']})}})
  const save=useMutation({mutationFn:()=>api.put(`/dashboards/${draft!.id}`,{name:draft!.name,status:draft!.status,widgets:draft!.widgets}),onSuccess:()=>{void client.invalidateQueries({queryKey:['admin-dashboards']});void client.invalidateQueries({queryKey:['admin-dashboard',selected]})}})
  const duplicate=useMutation({mutationFn:()=>api.post<Summary>(`/dashboards/${draft!.id}/duplicate`),onSuccess:response=>{setSelected(response.data.id);void client.invalidateQueries({queryKey:['admin-dashboards']})}})
  const remove=useMutation({mutationFn:()=>api.delete(`/dashboards/${draft!.id}`),onSuccess:()=>{setSelected('');setDraft(null);void client.invalidateQueries({queryKey:['admin-dashboards']})}})
  const assign=useMutation({mutationFn:()=>api.put(`/dashboards/${draft!.id}/assignments`,{principal_type:assignmentType,principal_id:assignmentType==='organization'?null:principalId}),onSuccess:()=>{setPrincipalId('');void client.invalidateQueries({queryKey:['dashboard-assignments',selected]});void client.invalidateQueries({queryKey:['admin-dashboards']})}})
  const unassign=useMutation({mutationFn:(id:string)=>api.delete(`/dashboards/${draft!.id}/assignments/${id}`),onSuccess:()=>{void client.invalidateQueries({queryKey:['dashboard-assignments',selected]});void client.invalidateQueries({queryKey:['admin-dashboards']})}})
  function dragEnd(event:DragEndEvent){if(!draft||!event.over||event.active.id===event.over.id)return;const from=draft.widgets.findIndex(widget=>widget.id===event.active.id),to=draft.widgets.findIndex(widget=>widget.id===event.over!.id);setDraft({...draft,widgets:arrayMove(draft.widgets,from,to).map((widget,index)=>({...widget,position:index}))})}
  const options=assignmentType==='role'?roles.data:assignmentType==='team'?teams.data:users.data
  return <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',lg:'280px 1fr'},gap:2}}>
    <Paper variant="outlined" sx={{p:1.5}}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb:1}}><Typography variant="h6">Dashboards</Typography>{can('dashboards.create')&&<IconButton aria-label="Create dashboard" onClick={()=>setCreateOpen(true)}><Add/></IconButton>}</Stack>{list.data?.map(item=><Button key={item.id} fullWidth color="inherit" onClick={()=>setSelected(item.id)} sx={{justifyContent:'space-between',mb:.5,bgcolor:selected===item.id?'action.selected':undefined}}>{item.name}<Typography variant="caption">{item.status}</Typography></Button>)}</Paper>
    {draft?<Box>
      <Stack direction={{xs:'column',sm:'row'}} gap={1} sx={{mb:2}}><TextField size="small" label="Dashboard name" value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/><TextField size="small" select label="Status" value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value})}><MenuItem value="draft">Draft</MenuItem><MenuItem value="published">Published</MenuItem></TextField><Button variant="contained" disabled={save.isPending} onClick={()=>save.mutate()}>Save / Publish</Button><Button startIcon={<ContentCopy/>} disabled={!can('dashboards.create')} onClick={()=>duplicate.mutate()}>Duplicate</Button><Button color="error" startIcon={<DeleteOutline/>} disabled={!can('dashboards.delete')||draft.is_default} onClick={()=>window.confirm(`Delete ${draft.name}?`)&&remove.mutate()}>Delete</Button></Stack>
      <DndContext collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={draft.widgets.map(widget=>widget.id)} strategy={verticalListSortingStrategy}><Stack gap={1}>{draft.widgets.map(widget=><SortableWidget key={widget.id} widget={widget} onChange={value=>setDraft({...draft,widgets:draft.widgets.map(item=>item.id===value.id?value:item)})} onDelete={()=>setDraft({...draft,widgets:draft.widgets.filter(item=>item.id!==widget.id)})}/>)}</Stack></SortableContext></DndContext>
      <Button sx={{mt:2}} startIcon={<Add/>} onClick={()=>setDraft({...draft,widgets:[...draft.widgets,{id:`new-${crypto.randomUUID()}`,type:'kpi',title:'New widget',position:draft.widgets.length,width:4,height:1,configuration:{}}]})}>Add widget</Button>
      {can('dashboards.assign')&&<Paper variant="outlined" sx={{mt:3,p:2}}><Typography variant="h6" sx={{mb:1.5}}>Assignments</Typography><Stack direction={{xs:'column',sm:'row'}} gap={1}><TextField select size="small" label="Assign to" value={assignmentType} onChange={event=>{setAssignmentType(event.target.value as Assignment['principal_type']);setPrincipalId('')}}>{['organization','role','team','user'].map(value=><MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>{assignmentType!=='organization'&&<TextField select size="small" label={assignmentType} value={principalId} onChange={event=>setPrincipalId(event.target.value)} sx={{minWidth:220}}>{options?.map(option=><MenuItem key={option.id} value={option.id}>{option.name||option.full_name||option.email}</MenuItem>)}</TextField>}<Button variant="outlined" disabled={assign.isPending||(assignmentType!=='organization'&&!principalId)} onClick={()=>assign.mutate()}>Assign</Button></Stack><Stack direction="row" gap={1} flexWrap="wrap" sx={{mt:1.5}}>{assignments.data?.map(value=><Button key={value.id} size="small" color="inherit" variant="outlined" endIcon={<DeleteOutline/>} onClick={()=>unassign.mutate(value.id)}>{value.principal_type}: {value.principal_id}</Button>)}</Stack></Paper>}
      <Paper variant="outlined" sx={{mt:3,p:2}}><Typography variant="overline">Responsive preview</Typography><Box sx={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:1,mt:1}}>{draft.widgets.map(widget=><Paper key={widget.id} variant="outlined" sx={{p:1.5,gridColumn:`span ${widget.width}`,minHeight:Math.max(80,widget.height*60),bgcolor:'action.hover'}}><Typography fontWeight={700}>{widget.title}</Typography><Typography variant="caption">{widget.type.replaceAll('_',' ')}</Typography></Paper>)}</Box></Paper>
    </Box>:<Paper variant="outlined" sx={{p:5,textAlign:'center',color:'text.secondary'}}>Select a dashboard to edit and preview.</Paper>}
    <Dialog open={createOpen} onClose={()=>setCreateOpen(false)}><DialogTitle>Create dashboard</DialogTitle><DialogContent sx={{pt:'12px!important'}}><TextField autoFocus label="Dashboard name" value={name} onChange={event=>setName(event.target.value)}/></DialogContent><DialogActions><Button onClick={()=>setCreateOpen(false)}>Cancel</Button><Button variant="contained" disabled={name.length<2} onClick={()=>create.mutate()}>Create</Button></DialogActions></Dialog>
  </Box>
}
