import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './admin/AuthContext'
import StoreShell from './store/StoreShell'
// The product page is what ad visitors land on: it stays in the main bundle so it renders without an extra download.
import Product from './store/pages/Product'

// Everything else loads only when it is opened (the admin, with recharts, never reaches the storefront bundle)
const Home = lazy(() => import('./store/pages/Home'))
const Shop = lazy(() => import('./store/pages/Shop'))
const Checkout = lazy(() => import('./store/pages/Checkout'))
const OrderSuccess = lazy(() => import('./store/pages/OrderSuccess'))
const Page = lazy(() => import('./store/pages/Page'))
const NotFound = lazy(() => import('./store/pages/NotFound'))

const ProtectedRoute = lazy(() => import('./admin/ProtectedRoute'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const Login = lazy(() => import('./admin/pages/Login'))
const Dashboard = lazy(() => import('./admin/pages/Dashboard'))
const Orders = lazy(() => import('./admin/pages/Orders'))
const NewOrder = lazy(() => import('./admin/pages/NewOrder'))
const DeliverySheet = lazy(() => import('./admin/pages/DeliverySheet'))
const Leads = lazy(() => import('./admin/pages/Leads'))
const Waitlist = lazy(() => import('./admin/pages/Waitlist'))
const Products = lazy(() => import('./admin/pages/Products'))
const Categories = lazy(() => import('./admin/pages/Categories'))
const Reviews = lazy(() => import('./admin/pages/Reviews'))
const AdSpend = lazy(() => import('./admin/pages/AdSpend'))
const Visitors = lazy(() => import('./admin/pages/Visitors'))
const Pages = lazy(() => import('./admin/pages/Pages'))
const Settings = lazy(() => import('./admin/pages/Settings'))
const Pixel = lazy(() => import('./admin/pages/Pixel'))
const Business = lazy(() => import('./admin/pages/Business'))
const Planner = lazy(() => import('./admin/pages/Planner'))
const SalesEvents = lazy(() => import('./admin/pages/SalesEvents'))
const Customers = lazy(() => import('./admin/pages/Customers'))
const Reports = lazy(() => import('./admin/pages/Reports'))
const SystemStatus = lazy(() => import('./admin/pages/SystemStatus'))
const PrintOrders = lazy(() => import('./admin/pages/PrintOrders'))

const AdminLoading = () => <div className="grid min-h-screen place-items-center text-sm text-gray-500">Loading…</div>

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<AdminLoading />}>
        <Routes>
          <Route element={<StoreShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:slug" element={<Product />} />
            <Route path="/page/:slug" element={<Page />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            {/* any other address: a real "page not found" (was a silent jump to the home page) */}
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/admin/login" element={<Login />} />
          {/* printable packing slips / labels: no admin menu around them */}
          <Route path="/admin/print" element={<ProtectedRoute><PrintOrders /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="new-order" element={<NewOrder />} />
            <Route path="delivery" element={<DeliverySheet />} />
            <Route path="leads" element={<Leads />} />
            <Route path="waitlist" element={<Waitlist />} />
            <Route path="products" element={<Products />} />
            <Route path="categories" element={<Categories />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="ads" element={<AdSpend />} />
            <Route path="visitors" element={<Visitors />} />
            <Route path="pages" element={<Pages />} />
            <Route path="business" element={<Business />} />
            <Route path="settings" element={<Settings />} />
            <Route path="pixel" element={<Pixel />} />
            <Route path="planner" element={<Planner />} />
            <Route path="events" element={<SalesEvents />} />
            <Route path="customers" element={<Customers />} />
            <Route path="reports" element={<Reports />} />
            <Route path="system" element={<SystemStatus />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
