import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { LoadingState } from './components/States'
import { AppShell } from './layout/AppShell'

const AdminPage=lazy(()=>import('./pages/AdminPage').then(m=>({default:m.AdminPage})))
const DashboardPage=lazy(()=>import('./pages/DashboardPage').then(m=>({default:m.DashboardPage})))
const LoginPage=lazy(()=>import('./pages/LoginPage').then(m=>({default:m.LoginPage})))
const RegistrationPage=lazy(()=>import('./pages/RegistrationPage').then(m=>({default:m.RegistrationPage})))
const SupportPage=lazy(()=>import('./pages/SupportPage').then(m=>({default:m.SupportPage})))
const TasksPage=lazy(()=>import('./pages/TasksPage').then(m=>({default:m.TasksPage})))
const CalendarPage=lazy(()=>import('./pages/CalendarPage').then(m=>({default:m.CalendarPage})))
const TeamsPage=lazy(()=>import('./pages/TeamsPage').then(m=>({default:m.TeamsPage})))
const AnnouncementsPage=lazy(()=>import('./pages/AnnouncementsPage').then(m=>({default:m.AnnouncementsPage})))
const SettingsPage=lazy(()=>import('./pages/SettingsPage').then(m=>({default:m.SettingsPage})))
const PlatformPage=lazy(()=>import('./pages/PlatformPage').then(m=>({default:m.PlatformPage})))
const FilesPage=lazy(()=>import('./pages/FilesPage').then(m=>({default:m.FilesPage})))
const BandModulePage=lazy(()=>import('./pages/BandModulePage').then(m=>({default:m.BandModulePage})))
const NotesPage=lazy(()=>import('./pages/NotesPage').then(m=>({default:m.NotesPage})))
const ChangePasswordPage=lazy(()=>import('./pages/ChangePasswordPage').then(m=>({default:m.ChangePasswordPage})))
const TaskFlowHost=lazy(()=>import('./pages/TaskFlowHost').then(m=>({default:m.TaskFlowHost})))

function Protected(){const {user,loading}=useAuth();if(loading)return <LoadingState/>;return user?<Outlet/>:<Navigate to="/login" replace/>}
function WorkspaceAccess(){const {user}=useAuth();return user?.must_change_password?<Navigate to="/change-password" replace/>:<Outlet/>}
export default function App(){return <Suspense fallback={<LoadingState/>}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegistrationPage/>}/><Route path="/contact" element={<SupportPage/>}/><Route element={<Protected/>}><Route path="/change-password" element={<ChangePasswordPage/>}/><Route element={<WorkspaceAccess/>}><Route element={<AppShell/>}><Route index element={<Navigate to="/dashboard" replace/>}/><Route path="dashboard" element={<DashboardPage/>}/><Route path="tasks" element={<TasksPage/>}/><Route path="flow" element={<Navigate to="/flow/dashboard" replace/>}/><Route path="flow/*" element={<TaskFlowHost/>}/><Route path="schedule" element={<CalendarPage/>}/><Route path="notes" element={<NotesPage/>}/><Route path="teams" element={<TeamsPage/>}/><Route path="announcements" element={<AnnouncementsPage/>}/><Route path="files" element={<FilesPage/>}/><Route path="band/:module" element={<BandModulePage/>}/><Route path="admin" element={<AdminPage/>}/><Route path="platform" element={<PlatformPage/>}/><Route path="settings" element={<SettingsPage/>}/><Route path="support" element={<SupportPage/>}/></Route></Route></Route><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes></Suspense>}
