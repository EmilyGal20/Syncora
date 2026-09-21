import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { useQuery } from '@tanstack/react-query'
import { enUS, he } from 'date-fns/locale'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import i18n from '../i18n'
import { createSyncoraTheme } from '../theme'

export interface Preferences{locale:'en'|'he';theme:'light'|'dark'|'system';sidebar_collapsed:boolean;timezone:string;allow_locale:boolean;allow_theme:boolean}
const Context=createContext<{preferences:Preferences|null;update:(value:Partial<Preferences>)=>Promise<void>}>({preferences:null,update:async()=>undefined})

export function WorkspaceProvider({children}:{children:ReactNode}){
  const {user}=useAuth();const systemDark=useMediaQuery('(prefers-color-scheme: dark)')
  const query=useQuery({queryKey:['preferences',user?.id,user?.organization_id],enabled:!!user,queryFn:async()=>(await api.get<Preferences>('/preferences')).data})
  const preferences=query.data??null;const locale=preferences?.locale??'en';const direction=locale==='he'?'rtl':'ltr';const mode=preferences?.theme==='dark'||(preferences?.theme==='system'&&systemDark)?'dark':'light'
  useEffect(()=>{document.documentElement.dir=direction;document.documentElement.lang=locale;void i18n.changeLanguage(locale)},[direction,locale])
  const cache=useMemo(()=>createCache({key:direction==='rtl'?'muirtl':'mui',stylisPlugins:direction==='rtl'?[prefixer,rtlPlugin]:[prefixer]}),[direction])
  const theme=useMemo(()=>createSyncoraTheme(mode,direction,user?.workspace_primary_color,user?.workspace_secondary_color),[mode,direction,user?.workspace_primary_color,user?.workspace_secondary_color])
  async function update(value:Partial<Preferences>){await api.patch('/preferences',value);await query.refetch()}
  return <Context.Provider value={{preferences,update}}><CacheProvider value={cache}><ThemeProvider theme={theme}><LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale==='he'?he:enUS}><CssBaseline/>{children}</LocalizationProvider></ThemeProvider></CacheProvider></Context.Provider>
}
export const usePreferences=()=>useContext(Context)
