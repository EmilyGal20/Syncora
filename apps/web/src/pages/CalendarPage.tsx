import CalendarMonth from '@mui/icons-material/CalendarMonth'
import Close from '@mui/icons-material/Close'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import EditOutlined from '@mui/icons-material/EditOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import heLocale from '@fullcalendar/core/locales/he'
import { zodResolver } from '@hookform/resolvers/zod'
import { Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Skeleton, Stack, Switch, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addHours, startOfDay } from 'date-fns'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import React from 'react'
import { z } from 'zod'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { CreateAction } from '../components/CreateAction'
import { PageHeader } from '../components/PageHeader'
import { SyncoraDatePicker, SyncoraTimePicker } from '../components/SyncoraDateTime'
import { ErrorState } from '../components/States'

type Person={id:string;full_name:string;email:string}
type Team={id:string;name:string}
export type CalendarEvent={id:string;title:string;description:string;starts_at:string;ends_at:string;all_day:boolean;location:string;visibility:string;team_id:string|null;owner_user_id:string;creator_id:string;participants:Person[]}

export const eventFormSchema=z.object({
  title:z.string().trim().min(2,'Enter an event title'), description:z.string(), date:z.date(), allDay:z.boolean(),
  start:z.date(), end:z.date(), location:z.string().max(200), visibility:z.string(), teamId:z.string(), participants:z.array(z.string()),
}).refine(v=>v.allDay||v.end>v.start,{path:['end'],message:'End time must be after start time'})
export type EventForm=z.infer<typeof eventFormSchema>

const defaults=(date=new Date()):EventForm=>({title:'',description:'',date,start:addHours(startOfDay(date),9),end:addHours(startOfDay(date),10),allDay:false,location:'',visibility:'private',teamId:'',participants:[]})
const combine=(day:Date,time:Date)=>new Date(day.getFullYear(),day.getMonth(),day.getDate(),time.getHours(),time.getMinutes())
export function eventPayload(value:EventForm){
  const starts=value.allDay?startOfDay(value.date):combine(value.date,value.start)
  const ends=value.allDay?addHours(startOfDay(value.date),24):combine(value.date,value.end)
  return {title:value.title.trim(),description:value.description,starts_at:starts.toISOString(),ends_at:ends.toISOString(),all_day:value.allDay,location:value.location,visibility:value.visibility,team_id:value.teamId||null,participant_ids:value.participants}
}

function EventEditor({open,event,prefill,onClose,onSaved}:{open:boolean;event:CalendarEvent|null;prefill:Date|null;onClose:()=>void;onSaved:()=>void}){
  const {t}=useTranslation(); const {can}=useAuth(); const mobile=useMediaQuery('(max-width:600px)')
  const users=useQuery({queryKey:['calendar-users'],enabled:can('users.view'),queryFn:async()=>(await api.get<{items:Person[]}>('/users',{params:{page_size:100}})).data.items,retry:false})
  const teams=useQuery({queryKey:['calendar-teams'],enabled:can('teams.view'),queryFn:async()=>(await api.get<Team[]>('/teams')).data,retry:false})
  const form=useForm<EventForm>({resolver:zodResolver(eventFormSchema),defaultValues:defaults(prefill??new Date())})
  const qc=useQueryClient()
  const save=useMutation({mutationFn:(payload:ReturnType<typeof eventPayload>)=>event?api.patch(`/events/${event.id}`,payload):api.post('/events',payload),onSuccess:async()=>{await qc.invalidateQueries({queryKey:['events']});onSaved()}})
  const {reset}=form
  React.useEffect(()=>{if(!open)return;if(event){const start=new Date(event.starts_at),end=new Date(event.ends_at);reset({title:event.title,description:event.description,date:start,start,end,allDay:event.all_day,location:event.location,visibility:event.visibility,teamId:event.team_id??'',participants:event.participants.map(p=>p.id)})}else reset(defaults(prefill??new Date()))},[open,event,prefill,reset])
  return <Dialog open={open} onClose={onClose} fullScreen={mobile} fullWidth maxWidth="sm"><form onSubmit={form.handleSubmit(v=>save.mutate(eventPayload(v)))}><DialogTitle sx={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>{event?t('schedule.editEvent'):t('schedule.new')}<IconButton onClick={onClose} aria-label={t('common.close')}><Close/></IconButton></DialogTitle><DialogContent sx={{display:'grid',gap:2,pt:'12px!important'}}>
    <Controller name="title" control={form.control} render={({field,fieldState})=><TextField {...field} autoFocus label={t('schedule.eventTitle')} error={!!fieldState.error} helperText={fieldState.error?.message}/>}/>
    <Controller name="description" control={form.control} render={({field})=><TextField {...field} multiline minRows={3} label={t('schedule.description')}/>}/>
    <Controller name="date" control={form.control} render={({field,fieldState})=><SyncoraDatePicker label={t('schedule.date')} value={field.value} onChange={v=>v&&field.onChange(v)} error={fieldState.error?.message}/>}/>
    <Controller name="allDay" control={form.control} render={({field})=><FormControlLabel control={<Switch checked={field.value} onChange={(_,v)=>field.onChange(v)}/>} label={t('schedule.allDay')}/>}/>
    {!form.watch('allDay')&&<Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr'},gap:2}}><Controller name="start" control={form.control} render={({field,fieldState})=><SyncoraTimePicker label={t('schedule.start')} value={field.value} onChange={v=>v&&field.onChange(v)} error={fieldState.error?.message}/>}/><Controller name="end" control={form.control} render={({field,fieldState})=><SyncoraTimePicker label={t('schedule.end')} value={field.value} onChange={v=>v&&field.onChange(v)} error={fieldState.error?.message}/>} /></Box>}
    <Controller name="location" control={form.control} render={({field})=><TextField {...field} label={t('schedule.location')}/>}/>
    <Controller name="visibility" control={form.control} render={({field})=><TextField {...field} select label={t('schedule.visibility')}>{['private','participants','team','department','organization'].map(v=><MenuItem key={v} value={v}>{t(`schedule.visibilityValues.${v}`)}</MenuItem>)}</TextField>}/>
    {teams.data&&<Controller name="teamId" control={form.control} render={({field})=><TextField {...field} select label={t('schedule.team')}><MenuItem value="">{t('common.none')}</MenuItem>{teams.data.map(x=><MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}</TextField>}/>}
    {users.data&&<Controller name="participants" control={form.control} render={({field})=><Autocomplete multiple options={users.data} value={users.data.filter(x=>field.value.includes(x.id))} getOptionLabel={x=>x.full_name||x.email} onChange={(_,v)=>field.onChange(v.map(x=>x.id))} renderInput={params=><TextField {...params} label={t('schedule.participants')}/>}/>}/>}
    {save.isError&&<Typography color="error" role="alert">{t('common.saveError')}</Typography>}
  </DialogContent><DialogActions><Button onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" variant="contained" disabled={save.isPending}>{t('common.save')}</Button></DialogActions></form></Dialog>
}

function EventDetails({event,onClose,onEdit,onDelete,canEdit,canDelete}:{event:CalendarEvent;onClose:()=>void;onEdit:()=>void;onDelete:()=>void;canEdit:boolean;canDelete:boolean}){
  const {t,i18n}=useTranslation();const allDay=event.all_day;const start=new Date(event.starts_at);const end=new Date(event.ends_at)
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle sx={{pr:7}}>{event.title}<IconButton sx={{position:'absolute',right:12,top:10}} onClick={onClose} aria-label={t('common.close')}><Close/></IconButton></DialogTitle><DialogContent><Stack spacing={2}>
    <Stack direction="row" spacing={1.5}><CalendarMonth color="primary"/><Box><Typography fontWeight={700}>{new Intl.DateTimeFormat(i18n.language,{dateStyle:'full'}).format(start)}</Typography><Typography color="text.secondary">{allDay?t('schedule.allDay'):`${new Intl.DateTimeFormat(i18n.language,{timeStyle:'short'}).format(start)} - ${new Intl.DateTimeFormat(i18n.language,{timeStyle:'short'}).format(end)}`}</Typography></Box></Stack>
    {event.location&&<Stack direction="row" spacing={1.5}><PlaceOutlined color="primary"/><Typography>{event.location}</Typography></Stack>}
    <Stack direction="row" flexWrap="wrap" gap={1}>{event.participants.map(p=><Chip key={p.id} label={p.full_name||p.email} size="small"/>)}<Chip label={t(`schedule.visibilityValues.${event.visibility}`)} size="small" variant="outlined"/></Stack>
    {event.description&&<Typography sx={{whiteSpace:'pre-wrap'}}>{event.description}</Typography>}
  </Stack></DialogContent>{(canEdit||canDelete)&&<DialogActions>{canDelete&&<Button color="error" startIcon={<DeleteOutline/>} onClick={onDelete}>{t('common.delete')}</Button>}{canEdit&&<Button variant="contained" startIcon={<EditOutlined/>} onClick={onEdit}>{t('common.edit')}</Button>}</DialogActions>}</Dialog>
}

export function CalendarPage(){
  const {t,i18n}=useTranslation();const {can,scopeFor}=useAuth();const theme=useTheme();const mobile=useMediaQuery(theme.breakpoints.down('sm'));const qc=useQueryClient()
  const [userId,setUserId]=React.useState('');const [selected,setSelected]=React.useState<CalendarEvent|null>(null);const [editor,setEditor]=React.useState(false);const [prefill,setPrefill]=React.useState<Date|null>(null)
  const organizationScope=scopeFor('schedule.view')==='ORGANIZATION';const users=useQuery({queryKey:['schedule-filter-users'],enabled:organizationScope&&can('users.view'),queryFn:async()=>(await api.get<{items:Person[]}>('/users',{params:{page_size:100}})).data.items})
  const events=useQuery({queryKey:['events',userId],queryFn:async()=>(await api.get<CalendarEvent[]>('/events',{params:userId?{user_id:userId}:{}})).data})
  const remove=useMutation({mutationFn:(id:string)=>api.delete(`/events/${id}`),onSuccess:async()=>{setSelected(null);await qc.invalidateQueries({queryKey:['events']})}})
  const begin=(date:Date)=>{setSelected(null);setPrefill(date);setEditor(true)}
  const onDateClick=(arg:DateClickArg)=>{if(can('schedule.create'))begin(arg.date)}
  const calendarStyles={
    bgcolor:'background.paper',border:'1px solid',borderColor:'divider',borderRadius:2,p:{xs:1,sm:2},minHeight:{xs:600,md:'calc(100vh - 250px)'},overflow:'hidden',
    '& .fc':{fontFamily:'inherit',color:'text.primary','--fc-border-color':theme.palette.divider,'--fc-page-bg-color':theme.palette.background.paper,'--fc-neutral-bg-color':theme.palette.action.hover,'--fc-today-bg-color':theme.palette.mode==='light'?'rgba(23,107,91,.10)':'rgba(131,112,245,.14)','--fc-event-bg-color':theme.palette.primary.main,'--fc-event-border-color':theme.palette.primary.main,'--fc-button-bg-color':theme.palette.background.paper,'--fc-button-border-color':theme.palette.divider,'--fc-button-text-color':theme.palette.text.primary,'--fc-button-hover-bg-color':theme.palette.action.hover,'--fc-button-hover-border-color':theme.palette.primary.main,'--fc-button-active-bg-color':theme.palette.primary.main,'--fc-button-active-border-color':theme.palette.primary.main},
    '& .fc-toolbar':{flexWrap:'wrap',gap:1.5,alignItems:'center'},'& .fc-toolbar-title':{fontSize:{xs:'1.05rem',sm:'1.35rem'},fontWeight:750},'& .fc-button':{boxShadow:'none!important',textTransform:'none',borderRadius:'6px!important',fontWeight:650},'& .fc-button-primary:not(:disabled).fc-button-active':{color:theme.palette.primary.contrastText},'& .fc-col-header-cell-cushion':{py:1.5,color:'text.secondary',fontWeight:700},'& .fc-daygrid-day-number':{p:1.1,fontWeight:650},'& .fc-daygrid-day:hover':{bgcolor:'action.hover'},'& .fc-event':{borderRadius:'5px',px:.4,py:.2,fontSize:'.78rem',fontWeight:650,cursor:'pointer'},'& .fc-timegrid-slot':{height:'2.9rem'},'& .fc-timegrid-now-indicator-line':{borderColor:'error.main'},'& .fc-timegrid-now-indicator-arrow':{borderColor:'error.main'},
  }
  return <><PageHeader title={t('schedule.title')} action={can('schedule.create')?<CreateAction label={t('schedule.new')} onClick={()=>begin(new Date())}/>:undefined}/>
    {users.data&&<Box sx={{display:'flex',mb:2,maxWidth:320}}><TextField select fullWidth size="small" label={t('schedule.userFilter')} value={userId} onChange={e=>setUserId(e.target.value)}><MenuItem value="">{t('schedule.allUsers')}</MenuItem>{users.data.map(u=><MenuItem key={u.id} value={u.id}>{u.full_name||u.email}</MenuItem>)}</TextField></Box>}
    {events.isLoading?<Skeleton variant="rounded" height={650}/>:events.isError?<ErrorState/>:<Box sx={calendarStyles}><FullCalendar plugins={[dayGridPlugin,timeGridPlugin,interactionPlugin]} locales={[heLocale]} locale={i18n.language==='he'?'he':'en'} direction={i18n.dir()} initialView={mobile?'timeGridDay':'dayGridMonth'} height="auto" nowIndicator selectable={can('schedule.create')} selectMirror dayMaxEvents={mobile?2:4} headerToolbar={{left:'today prev,next',center:'title',right:mobile?'dayGridMonth,timeGridDay':'dayGridMonth,timeGridWeek,timeGridDay'}} buttonText={{today:t('schedule.today'),month:t('schedule.month'),week:t('schedule.week'),day:t('schedule.day')}} events={events.data?.map(e=>({id:e.id,title:e.title,start:e.starts_at,end:e.ends_at,allDay:e.all_day,extendedProps:{event:e}}))} dateClick={onDateClick} select={arg=>can('schedule.create')&&begin(arg.start)} eventClick={arg=>setSelected(arg.event.extendedProps.event as CalendarEvent)}/></Box>}
    {selected&&!editor&&<EventDetails event={selected} onClose={()=>setSelected(null)} canEdit={can('schedule.edit')} canDelete={can('schedule.delete')} onEdit={()=>{setPrefill(null);setEditor(true)}} onDelete={()=>{if(window.confirm(t('schedule.confirmDelete')))remove.mutate(selected.id)}}/>}
    <EventEditor open={editor} event={selected} prefill={prefill} onClose={()=>setEditor(false)} onSaved={()=>{setEditor(false);setSelected(null)}}/>
  </>
}
