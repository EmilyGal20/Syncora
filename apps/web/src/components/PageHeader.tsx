import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
export function PageHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}){
  return (
    <Box sx={{display:'flex',flexDirection:{xs:'column',sm:'row'},gap:{xs:1.5,sm:2},alignItems:{xs:'stretch',sm:'start'},justifyContent:'space-between',mb:{xs:2,sm:3}}}>
      <Box sx={{minWidth:0}}>
        <Typography variant="h4" component="h1" sx={{wordBreak:'break-word'}}>{title}</Typography>
        {subtitle&&<Typography color="text.secondary" sx={{mt:.5}}>{subtitle}</Typography>}
      </Box>
      {action&&<Box sx={{display:'flex',flexWrap:'wrap',gap:1,alignItems:'center',flexShrink:0}}>{action}</Box>}
    </Box>
  )
}
