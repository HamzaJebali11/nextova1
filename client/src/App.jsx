import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './admin/AuthContext'
import ProtectedRoute from './admin/ProtectedRoute'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/pages/Dashboard'
import Orders from './admin/pages/Orders'
import Login from './admin/pages/Login'
import Products from './admin/pages/Products'
import Categories from './admin/pages/Categories'
import Settings from './admin/pages/Settings'
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
          <Route path="orders" element={<Orders />} />
<Route path="products" element={<Products />} />
<Route path="categories" element={<Categories />} />
<Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}