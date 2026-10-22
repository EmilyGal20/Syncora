import { Box, useTheme } from '@mui/material'
import darkLogo from '../assets/brand/syncora-logo-dark.png'
import lightLogo from '../assets/brand/syncora-logo-light.png'
import mark from '../assets/brand/syncora-mark.png'
import wordmark from '../assets/brand/syncora-wordmark.png'

const loader = '/logos/syncora-loader.svg?v=4'

export function SyncoraLogo({compact=false,asset='logo',variant='auto'}:{compact?:boolean;asset?:'logo'|'mark'|'wordmark';variant?:'auto'|'light'|'dark'}) {
  const theme=useTheme()
  const resolved=variant==='auto'?theme.palette.mode:variant
  const alt=asset==='mark'?'Syncora':'Syncora - Plan, Manage, Connect'
  if(compact&&asset==='logo'){
    return <Box sx={{display:'flex',alignItems:'center',gap:{xs:.75,sm:1},minWidth:0,flexShrink:0,overflow:'visible'}} data-brand-asset="lockup" data-brand-variant={resolved}>
      <Box component="img" src={mark} alt="" aria-hidden sx={{display:'block',height:{xs:32,sm:36},width:'auto',flexShrink:0}}/>
      <Box component="img" src={wordmark} alt={alt} data-brand-asset="lockup" data-brand-variant={resolved} sx={{display:'block',height:{xs:24,sm:28},width:'auto',maxWidth:{xs:132,sm:168},objectFit:'contain'}}/>
    </Box>
  }
  const source=asset==='mark'?mark:asset==='wordmark'?wordmark:resolved==='dark'?darkLogo:lightLogo
  return <Box component="img" src={source} alt={alt} data-brand-variant={resolved} data-brand-asset={asset} sx={{display:'block',width:compact?142:asset==='mark'?{xs:76,sm:88}:{xs:190,sm:240},height:'auto',maxWidth:'100%',objectFit:'contain'}}/>
}

export const SyncoraLoader=({label='Loading Syncora',size=168}:{label?:string;size?:number})=><Box component="img" role="status" src={loader} aria-label={label} sx={{display:'block',width:size,height:'auto'}}/>

export function SyncoraLoadingSurface({message}:{message:string}){return <Box data-testid="syncora-loading-surface" sx={{position:'fixed',inset:0,zIndex:1500,display:'grid',placeItems:'center',bgcolor:'background.default',animation:'surfaceIn .22s ease-out','@keyframes surfaceIn':{from:{opacity:0},to:{opacity:1}},'@media (prefers-reduced-motion: reduce)':{animation:'none'}}}><Box sx={{display:'grid',placeItems:'center',gap:2.5}}><SyncoraLoader size={220}/><SyncoraLogo asset="wordmark"/><Box sx={{color:'text.secondary',fontSize:14}}>{message}</Box></Box></Box>}
