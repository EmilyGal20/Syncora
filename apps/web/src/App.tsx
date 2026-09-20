import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { LoadingState } from './components/States'
import { AppShell } from './layout/AppShell'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { SimplePage } from './pages/SimplePage'
import { TasksPage } from './pages/TasksPage'
function Protected(){const {user,loading}=useAuth();if(loading)return <LoadingState/>;return user?<Outlet/>:<Navigate to="/login" replace/>}
export default function App(){return <Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route element={<AppShell/>}><Route index element={<Navigate to="/dashboard" replace/>}/><Route path="dashboard" element={<DashboardPage/>}/><Route path="tasks" element={<TasksPage/>}/><Route path="schedule" element={<SimplePage title="Schedule" subtitle="Coordinate meetings, deadlines, and organization events."/>}/><Route path="teams" element={<SimplePage title="Teams" subtitle="See team membership and shared responsibilities."/>}/><Route path="announcements" element={<SimplePage title="Announcements" subtitle="Keep everyone aligned with important updates."/>}/><Route path="admin" element={<AdminPage/>}/><Route path="settings" element={<SimplePage title="Settings" subtitle="Manage your personal workspace preferences."/>}/></Route></Route><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>}

