import { Card, CardContent, Typography } from '@mui/material'
import { PageHeader } from '../components/PageHeader'
export function SimplePage({title,subtitle}:{title:string;subtitle:string}){return <><PageHeader title={title} subtitle={subtitle}/><Card><CardContent><Typography variant="h6">Your organization workspace</Typography><Typography color="text.secondary" sx={{mt:1}}>This module is connected to the shared application shell and ready for organization-scoped workflows.</Typography></CardContent></Card></>}

