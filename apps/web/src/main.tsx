import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { WorkspaceProvider } from './preferences/WorkspaceProvider'
import './i18n'
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:1}}})
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><WorkspaceProvider><App/></WorkspaceProvider></AuthProvider></BrowserRouter></QueryClientProvider></StrictMode>)
