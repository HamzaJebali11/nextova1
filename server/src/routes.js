import { Router } from 'express'
import authRoutes from './modules/auth/auth.routes.js'
import categoryRoutes from './modules/categories/category.routes.js'
import productRoutes from './modules/products/product.routes.js'
import orderRoutes from './modules/orders/order.routes.js'
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

const router = Router()

router.use('/auth', authRoutes)
router.use('/categories', categoryRoutes)
router.use('/products', productRoutes)
router.use('/orders', orderRoutes)
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

export default router