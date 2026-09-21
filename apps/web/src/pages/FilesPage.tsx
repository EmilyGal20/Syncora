import AttachFile from '@mui/icons-material/AttachFile'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import Download from '@mui/icons-material/Download'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PreviewOutlined from '@mui/icons-material/PreviewOutlined'
import UploadFile from '@mui/icons-material/UploadFile'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { DragEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'

interface Attachment{id:string;context_type:string;context_id:string}
interface StoredFile{id:string;display_name:string;content_type:string;size:number;context_type:string;created_at:string;attachments:Attachment[]}
const size=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`
const previewable=(type:string)=>type.startsWith('image/')||type.startsWith('audio/')||type==='application/pdf'||type==='text/plain'||type==='text/csv'
const errorText=(error:unknown)=>axios.isAxiosError(error)&&typeof error.response?.data?.detail==='string'?error.response.data.detail:'The operation could not be completed.'

export function FilesPage(){
  const {can}=useAuth();const qc=useQueryClient();const input=useRef<HTMLInputElement>(null)
  const [search,setSearch]=useState('');const [progress,setProgress]=useState(0);const [dragging,setDragging]=useState(false)
  const [renameTarget,setRenameTarget]=useState<StoredFile|null>(null);const [rename,setRename]=useState('')
  const [deleteTarget,setDeleteTarget]=useState<StoredFile|null>(null);const [attachTarget,setAttachTarget]=useState<StoredFile|null>(null)
  const [link,setLink]=useState({context_type:'song',context_id:''});const [preview,setPreview]=useState<{file:StoredFile;url:string}|null>(null)
  const files=useQuery({queryKey:['files',search],queryFn:async()=>(await api.get<StoredFile[]>('/files',{params:{search}})).data})
  const upload=useMutation({mutationFn:async(file:File)=>{const body=new FormData();body.append('file',file);return api.post('/files',body,{onUploadProgress:event=>setProgress(event.total?Math.round(event.loaded/event.total*100):0)})},onSuccess:async()=>{setProgress(0);await qc.invalidateQueries({queryKey:['files']})}})
  const renameMutation=useMutation({mutationFn:()=>api.patch(`/files/${renameTarget!.id}`,{display_name:rename.trim()}),onSuccess:async()=>{setRenameTarget(null);await qc.invalidateQueries({queryKey:['files']})}})
  const remove=useMutation({mutationFn:()=>api.delete(`/files/${deleteTarget!.id}`),onSuccess:async()=>{setDeleteTarget(null);await qc.invalidateQueries({queryKey:['files']})}})
  const attach=useMutation({mutationFn:()=>api.post(`/files/${attachTarget!.id}/attachments`,link),onSuccess:async()=>{setAttachTarget(null);setLink({...link,context_id:''});await qc.invalidateQueries({queryKey:['files']})}})
  const detach=useMutation({mutationFn:({fileId,id}:{fileId:string;id:string})=>api.delete(`/files/${fileId}/attachments/${id}`),onSuccess:()=>qc.invalidateQueries({queryKey:['files']})})
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url)},[preview])
  function select(file?:File){if(file&&!upload.isPending)upload.mutate(file)}
  function drop(event:DragEvent){event.preventDefault();setDragging(false);select(event.dataTransfer.files[0])}
  async function download(item:StoredFile){const response=await api.get(`/files/${item.id}/download`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.display_name;anchor.click();URL.revokeObjectURL(url)}
  async function openPreview(item:StoredFile){const response=await api.get(`/files/${item.id}/preview`,{responseType:'blob'});setPreview({file:item,url:URL.createObjectURL(response.data)})}
  if(files.isLoading)return <LoadingState/>;if(files.isError)return <ErrorState retry={()=>void files.refetch()}/>
  return <>
    <PageHeader title="Files" subtitle="Secure files for this workspace." action={can('files.upload')?<Button size="small" startIcon={<UploadFile/>} disabled={upload.isPending} onClick={()=>input.current?.click()}>Upload</Button>:undefined}/>
    <input ref={input} hidden type="file" onChange={e=>{select(e.target.files?.[0]);e.target.value=''}}/>
    {can('files.upload')&&<Paper variant="outlined" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')input.current?.click()}} onDragEnter={e=>{e.preventDefault();setDragging(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={drop} onClick={()=>input.current?.click()} sx={{p:3,mb:2,textAlign:'center',cursor:'pointer',borderStyle:'dashed',borderColor:dragging?'primary.main':'divider',bgcolor:dragging?'action.hover':'transparent'}}><UploadFile color="primary"/><Typography fontWeight={650}>Drop a file here or choose a file</Typography><Typography variant="caption" color="text.secondary">Documents, images, audio, CSV, and spreadsheets up to the configured limit</Typography></Paper>}
    <TextField size="small" label="Search files" value={search} onChange={e=>setSearch(e.target.value)} sx={{mb:2,width:{xs:'100%',sm:320}}}/>
    {upload.isPending&&<LinearProgress variant={progress?'determinate':'indeterminate'} value={progress} sx={{mb:2}}/>}{upload.isError&&<Alert severity="error" sx={{mb:2}}>{errorText(upload.error)}</Alert>}
    <Stack spacing={1}>{files.data?.map(item=><Paper variant="outlined" key={item.id} sx={{p:1.5,display:'flex',alignItems:'center',gap:1}}><Box minWidth={0} flex={1}><Typography noWrap fontWeight={650}>{item.display_name}</Typography><Typography variant="caption" color="text.secondary">{size(item.size)} · {item.context_type} · {new Date(item.created_at).toLocaleDateString()}</Typography><Box>{item.attachments.map(a=><Button key={a.id} size="small" startIcon={<AttachFile/>} disabled={detach.isPending} onClick={()=>detach.mutate({fileId:item.id,id:a.id})}>{a.context_type}</Button>)}</Box></Box>{previewable(item.content_type)&&<Tooltip title="Preview"><IconButton aria-label={`Preview ${item.display_name}`} onClick={()=>void openPreview(item)}><PreviewOutlined/></IconButton></Tooltip>}{can('files.upload')&&<><Tooltip title="Rename"><IconButton aria-label={`Rename ${item.display_name}`} onClick={()=>{setRenameTarget(item);setRename(item.display_name)}}><EditOutlined/></IconButton></Tooltip><Tooltip title="Attach"><IconButton aria-label={`Attach ${item.display_name}`} onClick={()=>setAttachTarget(item)}><AttachFile/></IconButton></Tooltip></>}{can('files.download')&&<Tooltip title="Download"><IconButton aria-label={`Download ${item.display_name}`} onClick={()=>void download(item)}><Download/></IconButton></Tooltip>}{can('files.delete')&&<Tooltip title="Delete"><IconButton color="error" aria-label={`Delete ${item.display_name}`} onClick={()=>setDeleteTarget(item)}><DeleteOutline/></IconButton></Tooltip>}</Paper>)}</Stack>
    {!files.data?.length&&<Box sx={{py:8,textAlign:'center',color:'text.secondary'}}>No files in this workspace.</Box>}
    <Dialog open={!!renameTarget} onClose={()=>!renameMutation.isPending&&setRenameTarget(null)} fullWidth maxWidth="xs"><DialogTitle>Rename file</DialogTitle><DialogContent sx={{pt:'12px!important'}}><TextField autoFocus fullWidth label="Display name" value={rename} onChange={e=>setRename(e.target.value)} error={!rename.trim()}/>{renameMutation.isError&&<Alert severity="error" sx={{mt:2}}>{errorText(renameMutation.error)}</Alert>}</DialogContent><DialogActions><Button onClick={()=>setRenameTarget(null)}>Cancel</Button><Button variant="contained" disabled={!rename.trim()||renameMutation.isPending} onClick={()=>renameMutation.mutate()}>Save</Button></DialogActions></Dialog>
    <Dialog open={!!attachTarget} onClose={()=>!attach.isPending&&setAttachTarget(null)} fullWidth maxWidth="xs"><DialogTitle>Attach {attachTarget?.display_name}</DialogTitle><DialogContent sx={{display:'grid',gap:2,pt:'12px!important'}}><TextField select label="Resource type" value={link.context_type} onChange={e=>setLink({...link,context_type:e.target.value})}>{['show','rehearsal','song','task','equipment','expense','band'].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><TextField label="Resource ID" value={link.context_id} onChange={e=>setLink({...link,context_id:e.target.value})}/>{attach.isError&&<Alert severity="error">{errorText(attach.error)}</Alert>}</DialogContent><DialogActions><Button onClick={()=>setAttachTarget(null)}>Cancel</Button><Button variant="contained" disabled={link.context_id.length!==36||attach.isPending} onClick={()=>attach.mutate()}>Attach</Button></DialogActions></Dialog>
    <Dialog open={!!deleteTarget} onClose={()=>!remove.isPending&&setDeleteTarget(null)}><DialogTitle>Delete “{deleteTarget?.display_name}”?</DialogTitle><DialogContent><Typography>This permanently removes the file. Attached files must be detached first.</Typography>{remove.isError&&<Alert severity="error" sx={{mt:2}}>{errorText(remove.error)}</Alert>}</DialogContent><DialogActions><Button onClick={()=>setDeleteTarget(null)}>Cancel</Button><Button color="error" variant="contained" disabled={remove.isPending} onClick={()=>remove.mutate()}>Delete</Button></DialogActions></Dialog>
    <Dialog open={!!preview} onClose={()=>setPreview(null)} fullWidth maxWidth="md"><DialogTitle>{preview?.file.display_name}</DialogTitle><DialogContent sx={{height:{xs:'65vh',md:'75vh'},display:'grid',placeItems:'center'}}>{preview?.file.content_type.startsWith('image/')?<Box component="img" src={preview.url} alt={preview.file.display_name} sx={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/>:preview?.file.content_type.startsWith('audio/')?<Box component="audio" controls src={preview.url} sx={{width:'100%'}}/>:<Box component="iframe" title={preview?.file.display_name} src={preview?.url} sandbox="" sx={{border:0,width:'100%',height:'100%',bgcolor:'background.paper'}}/>}</DialogContent><DialogActions><Button onClick={()=>setPreview(null)}>Close</Button></DialogActions></Dialog>
  </>
}
