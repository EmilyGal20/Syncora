import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import ViewKanbanOutlined from '@mui/icons-material/ViewKanbanOutlined'
import ViewListOutlined from '@mui/icons-material/ViewListOutlined'
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { CreateAction } from '../components/CreateAction'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import type { Task } from '../types'

const blank={title:'',description:'',priority:'medium',status:'todo',due_date:'',visibility:'private'}
const errorText=(error:unknown)=>axios.isAxiosError(error)&&typeof error.response?.data?.detail==='string'?error.response.data.detail:'The task could not be saved.'

export function TasksPage(){
  const {t}=useTranslation();const {can}=useAuth();const qc=useQueryClient();const [view,setView]=useState('list');const [editing,setEditing]=useState<Task|null|undefined>(undefined);const [deleting,setDeleting]=useState<Task|null>(null);const [form,setForm]=useState(blank)
  const q=useQuery({queryKey:['tasks'],queryFn:async()=>(await api.get<Task[]>('/tasks')).data})
  const save=useMutation({mutationFn:()=>{const body={...form,due_date:form.due_date||null,tags:[]};return editing?.id?api.patch(`/tasks/${editing.id}`,body):api.post('/tasks',body)},onSuccess:async()=>{setEditing(undefined);setForm(blank);await qc.invalidateQueries({queryKey:['tasks']})}})
  const remove=useMutation({mutationFn:()=>api.delete(`/tasks/${deleting!.id}`),onSuccess:async()=>{setDeleting(null);await qc.invalidateQueries({queryKey:['tasks']})}})
  function begin(task?:Task){setEditing(task??null);setForm(task?{title:task.title,description:task.description,priority:task.priority,status:task.status,due_date:task.due_date?.slice(0,16)??'',visibility:'private'}:blank)}
  return <><PageHeader title={t('tasks.title')} subtitle={t('tasks.subtitle')} action={can('tasks.create')?<CreateAction label={t('tasks.new')} onClick={()=>begin()}/>:undefined}/><ToggleButtonGroup exclusive size="small" value={view} onChange={(_,v)=>v&&setView(v)} sx={{mb:2}}><ToggleButton value="list" aria-label="List view"><ViewListOutlined/></ToggleButton><ToggleButton value="board" aria-label="Board view"><ViewKanbanOutlined/></ToggleButton></ToggleButtonGroup>
    {q.isLoading?<LoadingState/>:q.isError?<ErrorState retry={()=>void q.refetch()}/>:!q.data?.length?<EmptyState title="No tasks yet" description="Create your first task to start organizing work."/>:<Box sx={{display:'grid',gridTemplateColumns:view==='board'?{xs:'1fr',md:'repeat(4,1fr)'}:'1fr',gap:2}}>{q.data.map(task=><Card key={task.id}><CardContent sx={{display:'flex',gap:1.5,alignItems:{xs:'start',sm:'center'},flexDirection:{xs:'column',sm:'row'}}}><Box sx={{flex:1,minWidth:0}}><Typography fontWeight={650}>{task.title}</Typography><Typography variant="body2" color="text.secondary">{task.description||'No description'}</Typography></Box><Chip size="small" label={task.status.replace('_',' ')} variant="outlined"/><Chip size="small" label={task.priority}/>{can('tasks.edit')&&<IconButton aria-label={`Edit ${task.title}`} onClick={()=>begin(task)}><EditOutlined/></IconButton>}{can('tasks.delete')&&<IconButton color="error" aria-label={`Delete ${task.title}`} onClick={()=>setDeleting(task)}><DeleteOutline/></IconButton>}</CardContent></Card>)}</Box>}
    <Dialog open={editing!==undefined} onClose={()=>!save.isPending&&setEditing(undefined)} fullWidth><DialogTitle>{editing?.id?'Edit task':t('tasks.new')}</DialogTitle><DialogContent sx={{display:'grid',gap:2,pt:'12px!important'}}><TextField autoFocus label="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><TextField label="Description" multiline minRows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><TextField select label="Status" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['todo','in_progress','blocked','completed'].map(x=><MenuItem key={x} value={x}>{x.replace('_',' ')}</MenuItem>)}</TextField><TextField select label="Priority" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{['low','medium','high','urgent'].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField label="Due date" type="datetime-local" slotProps={{inputLabel:{shrink:true}}} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/>{save.isError&&<Alert severity="error">{errorText(save.error)}</Alert>}</DialogContent><DialogActions><Button onClick={()=>setEditing(undefined)}>{t('common.cancel')}</Button><Button variant="contained" disabled={form.title.length<2||save.isPending} onClick={()=>save.mutate()}>{t('common.save')}</Button></DialogActions></Dialog>
    <Dialog open={!!deleting} onClose={()=>!remove.isPending&&setDeleting(null)}><DialogTitle>Delete “{deleting?.title}”?</DialogTitle><DialogContent><Typography>This task will be permanently removed.</Typography>{remove.isError&&<Alert severity="error" sx={{mt:2}}>{errorText(remove.error)}</Alert>}</DialogContent><DialogActions><Button onClick={()=>setDeleting(null)}>Cancel</Button><Button color="error" variant="contained" disabled={remove.isPending} onClick={()=>remove.mutate()}>Delete</Button></DialogActions></Dialog>
  </>
}
