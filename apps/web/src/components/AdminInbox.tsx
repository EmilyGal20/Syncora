import CheckCircle from '@mui/icons-material/CheckCircle'
import Close from '@mui/icons-material/Close'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { PagePermissions } from './PagePermissions'
import { LoadingState } from './States'

interface RequestItem{id:string;username:string;display_name:string;email:string|null;phone:string|null;workspace_name:string;workspace_type:string;workspace_mode:string;requested_role:string;description:string;details:Record<string,unknown>;status:string;created_at:string}
interface Named{id:string;name:string}
interface Options{workspace:Named;roles:Named[];dashboards:(Named&{status:string})[]}
interface Ticket{id:string;subject:string;requester_name:string;category:string;status:string;priority:string;description:string;created_at:string;messages?:{id:string;author_name:string;body:string;internal:boolean;created_at:string}[]}

export function AccessRequestsPanel() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const [selected, setSelected] = useState<RequestItem | null>(null)
  const [organizationId, setOrganizationId] = useState(user?.organization_id ?? '')
  const [assignment, setAssignment] = useState<'organization' | 'personal'>('organization')
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [dashboardId, setDashboardId] = useState('')
  const [response, setResponse] = useState('')
  const [internal, setInternal] = useState('')
  const [allowed, setAllowed] = useState<Set<string>>(new Set())
  const requests = useQuery({ queryKey: ['access-requests', status], queryFn: async () => (await api.get<RequestItem[]>('/registration-requests', { params: { status } })).data })
  const workspaces = useQuery({ queryKey: ['platform-workspaces'], enabled: !!user?.is_platform_admin, queryFn: async () => (await api.get<Named[]>('/platform/workspaces')).data })
  const workspaceChoices = workspaces.data ?? []
  const workspaceValue = user?.is_platform_admin && workspaceChoices.length && !workspaceChoices.some((value) => value.id === organizationId) ? '' : organizationId
  const options = useQuery({ queryKey: ['registration-options', organizationId], enabled: !!organizationId && !!selected && assignment === 'organization', queryFn: async () => (await api.get<Options>(`/registration-requests/options/${organizationId}`)).data })
  useEffect(() => {
    if (!selected) return
    const personal = selected.workspace_mode === 'new' || selected.workspace_type === 'other'
    setAssignment(personal ? 'personal' : 'organization')
    setOrganizationId(user?.organization_id ?? '')
    void api.post(`/registration-requests/${selected.id}/review`)
    setRoleIds([])
    setDashboardId('')
    setResponse('')
    setInternal('')
    setAllowed(new Set())
  }, [selected, user?.organization_id])
  useEffect(() => {
    if (!selected || !workspaceChoices.length) return
    const matched = workspaceChoices.find((item) => item.name.toLowerCase() === selected.workspace_name.toLowerCase())
    if (matched) setOrganizationId(matched.id)
  }, [selected, workspaceChoices])
  const approve = useMutation({
    mutationFn: () => api.post(`/registration-requests/${selected!.id}/approve`, {
      organization_id: assignment === 'personal' ? null : organizationId,
      create_workspace: assignment === 'personal',
      role_ids: roleIds,
      dashboard_id: dashboardId || null,
      permission_codes: [...allowed],
      applicant_response: response,
      internal_note: internal,
    }),
    onSuccess: () => {
      setSelected(null)
      void qc.invalidateQueries({ queryKey: ['access-requests'] })
    },
  })
  const reject = useMutation({
    mutationFn: () => api.post(`/registration-requests/${selected!.id}/reject`, { applicant_response: response, internal_note: internal }),
    onSuccess: () => {
      setSelected(null)
      void qc.invalidateQueries({ queryKey: ['access-requests'] })
    },
  })
  if (requests.isLoading) return <LoadingState />
  const canApprove = assignment === 'personal' ? !!user?.is_platform_admin : !!organizationId
  return (
    <>
      <Tabs value={status} onChange={(_, value) => setStatus(value)} variant="scrollable">
        {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((value) => (
          <Tab key={value} value={value} label={`${value.replace('_', ' ')}${value === status ? ` (${requests.data?.length ?? 0})` : ''}`} />
        ))}
      </Tabs>
      <Box sx={{ display: 'grid', gap: 1.5, mt: 2 }}>
        {requests.data?.map((item) => (
          <Paper key={item.id} variant="outlined" onClick={() => setSelected(item)} sx={{ p: 2, cursor: 'pointer', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr auto' }, gap: 1, alignItems: 'center' }}>
            <Box>
              <Typography fontWeight={750}>{item.display_name}</Typography>
              <Typography variant="body2" color="text.secondary">@{item.username} {item.email && `· ${item.email}`}</Typography>
            </Box>
            <Typography>{item.workspace_name}</Typography>
            <Typography>{item.requested_role || item.workspace_type}</Typography>
            <Chip size="small" label={item.status} />
          </Paper>
        ))}
      </Box>
      {!requests.data?.length && <Alert severity="info" sx={{ mt: 2 }}>No {status.toLowerCase().replace('_', ' ')} access requests.</Alert>}
      <Dialog open={!!selected} onClose={() => setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {t('settings.admin.reviewRequest')}
          <Button aria-label="Close" onClick={() => setSelected(null)}><Close /></Button>
        </DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
          {selected && (
            <>
              <Box>
                <Typography variant="h6">{selected.display_name}</Typography>
                <Typography>@{selected.username} · {selected.email || 'No email'} · {selected.phone || 'No phone'}</Typography>
              </Box>
              <Box>
                <Typography fontWeight={700}>{t('settings.admin.requestedWorkspace')}</Typography>
                <Typography>{selected.workspace_name} · {selected.workspace_type} · {selected.workspace_mode === 'new' ? t('registration.newWorkspace') : t('registration.existing')}</Typography>
                <Typography>{selected.requested_role}</Typography>
                <Typography color="text.secondary">{selected.description}</Typography>
              </Box>
              <TextField select label={t('settings.admin.assignment')} value={assignment} onChange={(e) => setAssignment(e.target.value as 'organization' | 'personal')}>
                <MenuItem value="organization">{t('settings.admin.assignOrganization')}</MenuItem>
                <MenuItem value="personal">{t('settings.admin.assignPersonal')}</MenuItem>
              </TextField>
              {assignment === 'organization' && (
                <>
                  <TextField select label={t('settings.admin.organization')} value={workspaceValue} disabled={!!user?.is_platform_admin && workspaces.isLoading} onChange={(e) => { setOrganizationId(e.target.value); setRoleIds([]); setDashboardId('') }}>
                    <MenuItem value="" disabled>Select workspace</MenuItem>
                    {user?.is_platform_admin ? workspaceChoices.map((value) => <MenuItem key={value.id} value={value.id}>{value.name}</MenuItem>) : <MenuItem value={user?.organization_id}>{user?.workspace_name}</MenuItem>}
                  </TextField>
                  <TextField select SelectProps={{ multiple: true }} label="Roles" value={roleIds} onChange={(e) => setRoleIds(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)}>
                    {options.data?.roles.map((value) => <MenuItem key={value.id} value={value.id}>{value.name}</MenuItem>)}
                  </TextField>
                  <TextField select label={t('settings.admin.personalDashboard')} value={dashboardId} onChange={(e) => setDashboardId(e.target.value)}>
                    <MenuItem value="">{t('settings.admin.orgDefault')}</MenuItem>
                    {options.data?.dashboards.map((value) => <MenuItem key={value.id} value={value.id}>{value.name}</MenuItem>)}
                  </TextField>
                </>
              )}
              {assignment === 'personal' && !user?.is_platform_admin && <Alert severity="warning">{t('settings.admin.personalNeedsPlatform')}</Alert>}
              <Typography fontWeight={700}>{t('settings.admin.permissionsTitle')}</Typography>
              <PagePermissions mode="picker" allowed={allowed} onAllowedChange={setAllowed} subjectName={selected.display_name} />
              <TextField label={t('settings.admin.applicantResponse')} multiline minRows={2} value={response} onChange={(e) => setResponse(e.target.value)} />
              <TextField label={t('settings.admin.internalNote')} multiline minRows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="error" disabled={reject.isPending} onClick={() => reject.mutate()}>{t('booking.reject')}</Button>
          <Button variant="contained" startIcon={<CheckCircle />} disabled={!canApprove || approve.isPending} onClick={() => approve.mutate()}>{t('settings.admin.confirmApproval')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export function AdminSupportPanel(){const qc=useQueryClient();const [selected,setSelected]=useState('');const [reply,setReply]=useState('');const [internal,setInternal]=useState(false);const tickets=useQuery({queryKey:['support','admin'],queryFn:async()=>(await api.get<Ticket[]>('/support')).data});const detail=useQuery({queryKey:['support','admin',selected],enabled:!!selected,queryFn:async()=>(await api.get<Ticket>(`/support/${selected}`)).data});const send=useMutation({mutationFn:()=>api.post(`/support/${selected}/messages`,{body:reply,internal}),onSuccess:()=>{setReply('');void qc.invalidateQueries({queryKey:['support','admin',selected]})}});const status=useMutation({mutationFn:(value:string)=>api.patch(`/support/${selected}/status`,{status:value}),onSuccess:()=>{void qc.invalidateQueries({queryKey:['support']})}});return <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'320px 1fr'},gap:2}}><Stack spacing={1}>{tickets.data?.map(ticket=><Paper key={ticket.id} variant="outlined" onClick={()=>setSelected(ticket.id)} sx={{p:2,cursor:'pointer'}}><Typography fontWeight={700}>{ticket.subject}</Typography><Typography variant="caption">{ticket.requester_name} · {ticket.category}</Typography><Chip size="small" label={ticket.status} sx={{display:'flex',width:'fit-content',mt:1}}/></Paper>)}</Stack>{detail.data?<Paper variant="outlined" sx={{p:3}}><Box sx={{display:'flex',gap:1,alignItems:'center',flexWrap:'wrap'}}><Typography variant="h5" sx={{flex:1}}>{detail.data.subject}</Typography><TextField select size="small" label="Status" value={detail.data.status} onChange={e=>status.mutate(e.target.value)}>{['OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED'].map(value=><MenuItem key={value} value={value}>{value.replaceAll('_',' ')}</MenuItem>)}</TextField></Box><Typography color="text.secondary">{detail.data.requester_name} · {detail.data.category}</Typography><Stack spacing={1.5} sx={{my:3}}>{detail.data.messages?.map(message=><Box key={message.id} sx={{p:1.5,bgcolor:message.internal?'warning.main':'action.hover',color:message.internal?'warning.contrastText':'text.primary',borderRadius:1}}><Typography variant="caption" fontWeight={700}>{message.author_name}{message.internal?' · Internal note':''}</Typography><Typography>{message.body}</Typography></Box>)}</Stack><TextField fullWidth multiline minRows={3} label={internal?'Internal note':'Reply to requester'} value={reply} onChange={e=>setReply(e.target.value)}/><FormControlLabel control={<Switch checked={internal} onChange={(_,value)=>setInternal(value)}/>} label="Internal note"/><Button variant="contained" disabled={!reply||send.isPending} onClick={()=>send.mutate()}>{internal?'Add internal note':'Send reply'}</Button></Paper>:<Paper variant="outlined" sx={{p:4,color:'text.secondary'}}>Select a support ticket.</Paper>}</Box>}
