import { Box, useTheme } from '@mui/material'
import logo from '../assets/brand/syncora-logo-transparent.png'

export function SyncoraLogo({compact=false}:{compact?:boolean}) {
  const theme=useTheme()
  return <Box component="img" src={logo} alt="Syncora - Plan, Manage, Connect" data-brand-variant={theme.palette.mode} sx={{display:'block',width:compact?138:{xs:180,sm:220},height:'auto',aspectRatio:'1 / 1',objectFit:'contain',filter:theme.palette.mode==='dark'?'brightness(1.35) contrast(1.05)':'none'}}/>
}

export function SyncoraLoader({label='Loading Syncora'}:{label?:string}) {
  return <Box role="status" aria-label={label} sx={{width:52,height:52,'& .syncora-pulse':{transformOrigin:'32px 32px',animation:'syncoraPulse 1.6s ease-in-out infinite'},'@keyframes syncoraPulse':{'0%,100%':{opacity:.72,transform:'scale(.96)'},'50%':{opacity:1,transform:'scale(1.02)'}},'@media (prefers-reduced-motion: reduce)':{'& .syncora-pulse':{animation:'none',opacity:1}}}}>
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <defs><linearGradient id="syncora-loader-gradient" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#25C5F6"/><stop offset=".48" stopColor="#3156E8"/><stop offset="1" stopColor="#B45CFA"/></linearGradient></defs>
      <g className="syncora-pulse" fill="none" stroke="url(#syncora-loader-gradient)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"><path d="M48 16H25c-8 0-11 10-4 14l22 12c7 4 4 14-4 14H16"/><path opacity=".45" d="M16 8h22c8 0 11 10 4 14L20 34c-7 4-4 14 4 14h24"/></g>
    </svg>
  </Box>
}
