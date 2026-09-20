import { Box, useTheme } from '@mui/material'
import darkLogo from '../assets/brand/syncora-logo-dark.png'
import lightLogo from '../assets/brand/syncora-logo-light.png'
import mark from '../assets/brand/syncora-mark.png'
import wordmark from '../assets/brand/syncora-wordmark.png'
import loader from '../assets/brand/SyncoraLoader.svg'

export function SyncoraLogo({compact=false,asset='logo',variant='auto'}:{compact?:boolean;asset?:'logo'|'mark'|'wordmark';variant?:'auto'|'light'|'dark'}) {
  const theme=useTheme()
  const resolved=variant==='auto'?theme.palette.mode:variant
  const source=asset==='mark'?mark:asset==='wordmark'?wordmark:resolved==='dark'?darkLogo:lightLogo
  return <Box component="img" src={source} alt={asset==='mark'?'Syncora': 'Syncora - Plan, Manage, Connect'} data-brand-variant={resolved} data-brand-asset={asset} sx={{display:'block',width:compact?142:asset==='mark'?{xs:76,sm:88}:{xs:190,sm:240},height:'auto',maxWidth:'100%',objectFit:'contain'}}/>
}

export const SyncoraLoader=({label='Loading Syncora',size=72}:{label?:string;size?:number})=><Box component="img" role="status" src={loader} aria-label={label} sx={{display:'block',width:size,height:size}}/>

export function SyncoraLoadingSurface({message}:{message:string}){return <Box data-testid="syncora-loading-surface" sx={{position:'fixed',inset:0,zIndex:1500,display:'grid',placeItems:'center',bgcolor:'background.default',animation:'surfaceIn .22s ease-out','@keyframes surfaceIn':{from:{opacity:0},to:{opacity:1}},'@media (prefers-reduced-motion: reduce)':{animation:'none'}}}><Box sx={{display:'grid',placeItems:'center',gap:2}}><SyncoraLoader size={108}/><SyncoraLogo asset="wordmark"/><Box sx={{color:'text.secondary',fontSize:14}}>{message}</Box></Box></Box>}
