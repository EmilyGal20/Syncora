import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/AuthProvider'
import { SyncoraLoader, SyncoraLogo } from '../components/SyncoraBrand'

const schema=z.object({email:z.email(),password:z.string().min(8)})
type FormData=z.infer<typeof schema>

export function LoginPage(){
  const {user,login}=useAuth()
  const [error,setError]=useState('')
  const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<FormData>({resolver:zodResolver(schema),defaultValues:{email:'admin@syncora.dev',password:'ChangeMe123!'}})
  if(user)return <Navigate to="/dashboard" replace/>
  return <Box sx={{minHeight:'100vh',display:'grid',gridTemplateColumns:{md:'minmax(380px, 500px) 1fr'},bgcolor:'background.default'}}>
    <Box sx={{display:'grid',alignItems:'center',px:{xs:2.5,sm:7},py:4}}><Box component="main" sx={{width:'100%',maxWidth:400,mx:'auto'}}>
      <Box sx={{height:116,display:'flex',alignItems:'center',mb:3,overflow:'hidden'}}><SyncoraLogo/></Box>
      <Typography variant="h4">Welcome back</Typography><Typography color="text.secondary" sx={{mt:1,mb:4}}>Sign in to your organization workspace.</Typography>
      {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
      <Box component="form" onSubmit={handleSubmit(async d=>{setError('');try{await login(d.email,d.password)}catch{setError('The email or password is incorrect.')}})} sx={{display:'grid',gap:2}}>
        <TextField label="Work email" autoComplete="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message}/><TextField label="Password" type="password" autoComplete="current-password" {...register('password')} error={!!errors.password} helperText={errors.password?.message}/>
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting} sx={{height:48}}>{isSubmitting?<Box sx={{display:'flex',alignItems:'center',gap:1,'& [role=status]':{width:28,height:28}}}><SyncoraLoader label="Signing in"/><span>Signing in</span></Box>:'Sign in'}</Button>
      </Box><Typography variant="caption" color="text.secondary" sx={{display:'block',mt:3}}>Development workspace credentials are prefilled locally.</Typography>
    </Box></Box>
    <Paper square sx={{display:{xs:'none',md:'grid'},placeItems:'center',bgcolor:'#101015',color:'white',p:8,overflow:'hidden'}}><Box sx={{display:'grid',placeItems:'center',maxWidth:600}}><SyncoraLogo/><Typography sx={{mt:1,color:'#C9D2F4',fontSize:18,textAlign:'center'}}>Plan work, manage access, and keep your organization connected.</Typography></Box></Paper>
  </Box>
}
