import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import TaskFlowApp from '../taskflow/App'
import '../taskflow/index.css'

export function TaskFlowHost() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <TaskFlowApp
      embedded
      workspaceId={user?.organization_id}
      pathname={location.pathname}
      onNavigate={(path) => navigate(path)}
    />
  )
}
