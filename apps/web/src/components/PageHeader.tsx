import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
export function PageHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}){return <Box sx={{display:'flex',gap:2,alignItems:'start',justifyContent:'space-between',mb:3}}><Box><Typography variant="h4" component="h1">{title}</Typography>{subtitle&&<Typography color="text.secondary">{subtitle}</Typography>}</Box>{action}</Box>}
