import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { User } from '../types'

interface AuthValue { user:User|null; loading:boolean; login:(email:string,password:string)=>Promise<void>; logout:()=>Promise<void>; can:(permission:string)=>boolean }
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children:ReactNode }) {
  const [user, setUser] = useState<User|null>(null)
  const [loading, setLoading] = useState(true)
  const loadUser=useCallback(async() => { try { const { data } = await api.get<User>('/auth/me'); setUser(data) } catch { setUser(null) } finally { setLoading(false) } },[])
  useEffect(() => { if(sessionStorage.getItem('syncora_access_token'))void loadUser();else setLoading(false); const reset=()=>setUser(null); addEventListener('syncora:unauthorized',reset); return()=>removeEventListener('syncora:unauthorized',reset) }, [loadUser])
  const login=useCallback(async(email:string,password:string) => { const { data }=await api.post('/auth/login',{email,password}); sessionStorage.setItem('syncora_access_token',data.access_token); setLoading(true); await loadUser() },[loadUser])
  const logout=useCallback(async() => { await api.post('/auth/logout',{}).catch(()=>undefined); sessionStorage.clear(); setUser(null) },[])
  const value=useMemo(()=>({user,loading,login,logout,can:(p:string)=>Boolean(user?.permissions.includes(p))}),[user,loading,login,logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){ const value=useContext(AuthContext); if(!value) throw new Error('AuthProvider missing'); return value }
