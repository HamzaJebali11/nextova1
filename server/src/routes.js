import { Router } from 'express'
import authRoutes from './modules/auth/auth.routes.js'
import categoryRoutes from './modules/categories/category.routes.js'
import productRoutes from './modules/products/product.routes.js'
import orderRoutes from './modules/orders/order.routes.js'
import manualOrderRoutes from './modules/orders/manual.routes.js'
import settingsRoutes from './modules/settings/settings.routes.js'
import uploadRoutes from './modules/uploads/upload.routes.js'
import reviewRoutes from './modules/reviews/review.routes.js'
import adSpendRoutes from './modules/adspend/adspend.routes.js'
import analyticsRoutes from './modules/analytics/analytics.routes.js'
import leadRoutes from './modules/leads/lead.routes.js'
import pageRoutes from './modules/pages/page.routes.js'
import exportRoutes from './modules/exports/exports.routes.js'
import whatsappRoutes from './modules/whatsapp/whatsapp.routes.js'
import statsRoutes from './modules/stats/stats.routes.js'
import alertRoutes from './modules/alerts/alert.routes.js'
import countsRoutes from './modules/counts/counts.routes.js'
import healthRoutes from './modules/health/health.routes.js'
import planRoutes from './modules/plans/plan.routes.js'
import eventRoutes from './modules/events/event.routes.js'
import sitemapRoutes from './modules/sitemap/sitemap.routes.js'
import customerRoutes from './modules/customers/customer.routes.js'
import reportRoutes from './modules/reports/report.routes.js'
import systemRoutes from './modules/system/system.routes.js'
const router = Router()

router.use('/auth', authRoutes)
router.use('/categories', categoryRoutes)
router.use('/products', productRoutes)
router.use('/orders', orderRoutes)
router.use('/manual-orders', manualOrderRoutes)
router.use('/settings', settingsRoutes)
router.use('/uploads', uploadRoutes)
router.use('/reviews', reviewRoutes)
router.use('/adspend', adSpendRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/leads', leadRoutes)
router.use('/pages', pageRoutes)
router.use('/exports', exportRoutes)
router.use('/whatsapp', whatsappRoutes)
router.use('/stats', statsRoutes)
router.use('/alerts', alertRoutes)
router.use('/counts', countsRoutes)
router.use('/business-health', healthRoutes) // admin Business health (/health is the public 'server is up' check in index.js)
router.use('/plans', planRoutes) // admin-only planner (never touches real data)
router.use('/sitemap.xml', sitemapRoutes) // public, for search engines
router.use('/events', eventRoutes) // sales events: display only, never change prices
router.use('/customers', customerRoutes) // admin: customers built from orders + block list
router.use('/reports', reportRoutes)     // admin: delivery performance and profit reports
router.use('/system', systemRoutes)       // errors (client reports are public, rate limited) and admin System status

export default router