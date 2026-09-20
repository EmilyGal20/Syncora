import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { SyncoraLoadingSurface, SyncoraLogo } from '../components/SyncoraBrand'
import { useTranslation } from 'react-i18next'

const schema=z.object({email:z.email(),password:z.string().min(8)})
type FormData=z.infer<typeof schema>

export function LoginPage(){
  const {user,login}=useAuth()
  const {t}=useTranslation()
  const [error,setError]=useState('')
  const [transitioning,setTransitioning]=useState(false)
  const [ready,setReady]=useState(false)
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<FormData>({resolver:zodResolver(schema),defaultValues:{email:'admin@syncora.dev',password:'ChangeMe123!'}})
  if(user&&ready)return <Navigate to="/dashboard" replace/>
  if(transitioning)return <SyncoraLoadingSurface message={t('auth.preparing')}/>
  return <Box sx={{minHeight:'100vh',display:'grid',gridTemplateColumns:{md:'minmax(390px, 500px) 1fr'},bgcolor:'background.default'}}>
    <Box sx={{display:'grid',alignItems:'center',px:{xs:2.5,sm:7},py:{xs:3,sm:5},bgcolor:theme=>theme.palette.mode==='light'?'#F8F8F5':'background.default'}}><Box component="main" sx={{width:'100%',maxWidth:400,mx:'auto'}}>
      <Box sx={{height:88,display:'flex',alignItems:'center',mb:3}}><SyncoraLogo asset="wordmark"/></Box>
      <Typography variant="h4">{t('auth.welcome')}</Typography><Typography color="text.secondary" sx={{mt:1,mb:4}}>{t('auth.subtitle')}</Typography>
      {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
      <Box component="form" onSubmit={handleSubmit(async d=>{setError('');setTransitioning(true);const started=Date.now();try{await login(d.email,d.password);await new Promise(resolve=>setTimeout(resolve,Math.max(0,650-(Date.now()-started))));setReady(true)}catch{setTransitioning(false);setError(t('auth.invalid'))}})} sx={{display:'grid',gap:2}}>
        <TextField label={t('auth.email')} autoComplete="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message}/><TextField label={t('auth.password')} type="password" autoComplete="current-password" {...register('password')} error={!!errors.password} helperText={errors.password?.message}/>
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting} sx={{height:48}}>{isSubmitting?t('auth.signingIn'):t('auth.signIn')}</Button>
      </Box><Typography variant="caption" color="text.secondary" sx={{display:'block',mt:3}}>{t('auth.development')}</Typography>
    </Box></Box>
    <Paper square sx={{display:{xs:'none',md:'grid'},placeItems:'center',bgcolor:'#0D0D14',color:'white',p:{md:5,lg:8},overflow:'hidden'}}><Box sx={{display:'grid',placeItems:'center',maxWidth:620,width:'100%'}}><SyncoraLogo variant="dark"/><Typography sx={{mt:2,color:'#C9D2F4',fontSize:18,textAlign:'center'}}>{t('auth.brandMessage')}</Typography></Box></Paper>
  </Box>
}
