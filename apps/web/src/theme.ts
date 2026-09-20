import { createTheme } from '@mui/material/styles'
export const createSyncoraTheme=(mode:'light'|'dark',direction:'ltr'|'rtl')=>createTheme({
  direction,
  palette:{mode,primary:{main:mode==='light'?'#176B5B':'#58B8A5',dark:'#0E4D42'},secondary:{main:'#D87955'},background:{default:mode==='light'?'#F5F7F6':'#101714',paper:mode==='light'?'#FFFFFF':'#19231F'},text:{primary:mode==='light'?'#17221F':'#ECF3F0',secondary:mode==='light'?'#5B6864':'#AABAB4'},divider:mode==='light'?'#DCE3E0':'#34443E'},
  typography:{fontFamily:'Inter, Segoe UI, sans-serif',h4:{fontSize:'1.65rem',fontWeight:700},h5:{fontSize:'1.2rem',fontWeight:700},h6:{fontSize:'1rem',fontWeight:700},button:{textTransform:'none',fontWeight:650,letterSpacing:0}},
  shape:{borderRadius:6},
  components:{MuiButton:{defaultProps:{disableElevation:true}},MuiCard:{defaultProps:{variant:'outlined'},styleOverrides:{root:{boxShadow:'none'}}},MuiOutlinedInput:{styleOverrides:{root:{backgroundColor:mode==='light'?'#fff':'#19231F'}}},MuiCssBaseline:{styleOverrides:{body:{minWidth:320},'*:focus-visible':{outline:'3px solid #7FB6AB',outlineOffset:2},'@media (min-width:900px)':{'html[dir="rtl"] .MuiDrawer-paper':{left:'auto',right:0},'html[dir="rtl"] .MuiAppBar-root':{marginLeft:0,marginRight:248},'html[dir="rtl"] body:has(.MuiDrawer-root) main':{marginLeft:0,marginRight:248}}}}}
})
