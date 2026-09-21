import DeleteOutline from '@mui/icons-material/DeleteOutline'
import Download from '@mui/icons-material/Download'
import UploadFile from '@mui/icons-material/UploadFile'
import { Box, Button, IconButton, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'

interface StoredFile{id:string;display_name:string;content_type:string;size:number;context_type:string;created_at:string}
const size=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`

export function FilesPage(){const {can}=useAuth();const qc=useQueryClient();const input=useRef<HTMLInputElement>(null);const [search,setSearch]=useState('');const [progress,setProgress]=useState(0)
  const files=useQuery({queryKey:['files',search],queryFn:async()=>(await api.get<StoredFile[]>('/files',{params:{search}})).data})
  const upload=useMutation({mutationFn:async(file:File)=>{const body=new FormData();body.append('file',file);return api.post('/files',body,{onUploadProgress:event=>setProgress(event.total?Math.round(event.loaded/event.total*100):0)})},onSuccess:async()=>{setProgress(0);await qc.invalidateQueries({queryKey:['files']})}})
  const remove=useMutation({mutationFn:(id:string)=>api.delete(`/files/${id}`),onSuccess:()=>qc.invalidateQueries({queryKey:['files']})})
  async function download(item:StoredFile){const response=await api.get(`/files/${item.id}/download`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const anchor=document.createElement('a');anchor.href=url;anchor.download=item.display_name;anchor.click();URL.revokeObjectURL(url)}
  if(files.isLoading)return <LoadingState/>;if(files.isError)return <ErrorState/>
  return <><PageHeader title="Files" subtitle="Secure files for this workspace." action={can('files.upload')?<Button size="small" startIcon={<UploadFile/>} onClick={()=>input.current?.click()}>Upload</Button>:undefined}/><input ref={input} hidden type="file" onChange={e=>{const file=e.target.files?.[0];if(file)upload.mutate(file);e.target.value=''}}/><TextField size="small" label="Search files" value={search} onChange={e=>setSearch(e.target.value)} sx={{mb:2,width:{xs:'100%',sm:320}}}/>{upload.isPending&&<LinearProgress variant={progress?'determinate':'indeterminate'} value={progress} sx={{mb:2}}/>}{upload.isError&&<Typography color="error" sx={{mb:2}}>The file could not be uploaded. Check its type and size.</Typography>}<Stack spacing={1}>{files.data?.map(item=><Paper variant="outlined" key={item.id} sx={{p:1.5,display:'flex',alignItems:'center',gap:2}}><Box minWidth={0} flex={1}><Typography noWrap fontWeight={650}>{item.display_name}</Typography><Typography variant="caption" color="text.secondary">{size(item.size)} · {item.context_type} · {new Date(item.created_at).toLocaleDateString()}</Typography></Box>{can('files.download')&&<IconButton aria-label={`Download ${item.display_name}`} onClick={()=>void download(item)}><Download/></IconButton>}{can('files.delete')&&<IconButton color="error" aria-label={`Delete ${item.display_name}`} onClick={()=>remove.mutate(item.id)}><DeleteOutline/></IconButton>}</Paper>)}</Stack>{!files.data?.length&&<Box sx={{py:8,textAlign:'center',color:'text.secondary'}}>No files in this workspace.</Box>}</>
}
