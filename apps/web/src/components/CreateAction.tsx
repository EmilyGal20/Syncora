import Add from '@mui/icons-material/Add'
import { IconButton, Tooltip } from '@mui/material'
export function CreateAction({label,onClick}:{label:string;onClick:()=>void}){return <Tooltip title={label}><IconButton color="primary" onClick={onClick} aria-label={label} sx={{border:1,borderColor:'divider'}}><Add/></IconButton></Tooltip>}

