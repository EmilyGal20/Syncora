import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import TaskFlowApp from '../taskflow/App'
import '../taskflow/index.css'

const enginePermission: Record<string, string> = {
  dashboard: 'engine.dashboard',
  tasks: 'engine.tasks',
  board: 'engine.board',
  projects: 'engine.projects',
  calendar: 'engine.calendar',
  analytics: 'engine.analytics',
  planner: 'engine.planner',
}

export function TaskFlowHost() {
  const { user, can } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const page = location.pathname.split('/')[2] || 'dashboard'
  const required = enginePermission[page]
  const hasEngine = user?.permissions.some((code) => code.startsWith('engine.'))
  if (required && !can(required) && (hasEngine || !can('tasks.view'))) return <Navigate to="/dashboard" replace />
  return (
    <TaskFlowApp
      embedded
      workspaceId={user?.organization_id}
      pathname={location.pathname}
      onNavigate={(path) => navigate(path)}
    />
  )
}
