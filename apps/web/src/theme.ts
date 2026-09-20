import { createTheme } from '@mui/material/styles'
export const theme=createTheme({
  palette:{mode:'light',primary:{main:'#176B5B',dark:'#0E4D42'},secondary:{main:'#C45B35'},background:{default:'#F5F7F6',paper:'#FFFFFF'},text:{primary:'#17221F',secondary:'#5B6864'},divider:'#DCE3E0'},
  typography:{fontFamily:'Inter, Segoe UI, sans-serif',h4:{fontSize:'1.65rem',fontWeight:700},h5:{fontSize:'1.2rem',fontWeight:700},h6:{fontSize:'1rem',fontWeight:700},button:{textTransform:'none',fontWeight:650,letterSpacing:0}},
  shape:{borderRadius:6},
  components:{MuiButton:{defaultProps:{disableElevation:true}},MuiCard:{defaultProps:{variant:'outlined'},styleOverrides:{root:{boxShadow:'none'}}},MuiOutlinedInput:{styleOverrides:{root:{backgroundColor:'#fff'}}},MuiCssBaseline:{styleOverrides:{body:{minWidth:320},'*:focus-visible':{outline:'3px solid #7FB6AB',outlineOffset:2}}}}
})

