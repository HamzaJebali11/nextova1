import { Navigate } from 'react-router-dom'
import { useAuth } from './useAuth'
export default function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return <div className="grid h-screen place-items-center text-gray-500">Loading…</div>
  return admin ? children : <Navigate to="/admin/login" replace />
}