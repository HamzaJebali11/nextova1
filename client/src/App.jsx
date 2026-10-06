import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './admin/AuthContext'
import ProtectedRoute from './admin/ProtectedRoute'
import AdminLayout from './admin/AdminLayout'
import Login from './admin/pages/Login'
import Dashboard from './admin/pages/Dashboard'
import Orders from './admin/pages/Orders'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={
          <div className="grid h-screen place-items-center text-center text-gray-600">
            <div>Nextova storefront coming soon · <a className="underline" href="/admin">Admin</a></div>
          </div>
        } />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}