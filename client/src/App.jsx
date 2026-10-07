import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './admin/AuthContext'
import ProtectedRoute from './admin/ProtectedRoute'
import AdminLayout from './admin/AdminLayout'
import Login from './admin/pages/Login'
import Dashboard from './admin/pages/Dashboard'
import Orders from './admin/pages/Orders'
import Leads from './admin/pages/Leads'
import Products from './admin/pages/Products'
import Categories from './admin/pages/Categories'
import Reviews from './admin/pages/Reviews'
import AdSpend from './admin/pages/AdSpend'
import Pages from './admin/pages/Pages'
import Settings from './admin/pages/Settings'
import StoreShell from './store/StoreShell'
import Home from './store/pages/Home'
import Shop from './store/pages/Shop'
import Product from './store/pages/Product'
import Checkout from './store/pages/Checkout'
import OrderSuccess from './store/pages/OrderSuccess'
import Page from './store/pages/Page'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<StoreShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/page/:slug" element={<Page />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success" element={<OrderSuccess />} />
        </Route>

        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="leads" element={<Leads />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="ads" element={<AdSpend />} />
          <Route path="pages" element={<Pages />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}