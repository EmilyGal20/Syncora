import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
export const LoadingState=()=> <Box sx={{display:'grid',placeItems:'center',minHeight:240}}><CircularProgress aria-label="Loading"/></Box>
export const ErrorState=({message='We could not load this content.',retry}:{message?:string;retry?:()=>void})=> <Alert severity="error" action={retry?<Button color="inherit" onClick={retry}>Retry</Button>:undefined}>{message}</Alert>
export const EmptyState=({title,description}:{title:string;description:string})=> <Box sx={{py:8,textAlign:'center'}}><Typography variant="h6">{title}</Typography><Typography color="text.secondary">{description}</Typography></Box>

