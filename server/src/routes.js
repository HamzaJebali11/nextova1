import { Router } from 'express'
import authRoutes from './modules/auth/auth.routes.js'
import categoryRoutes from './modules/categories/category.routes.js'
import productRoutes from './modules/products/product.routes.js'
import orderRoutes from './modules/orders/order.routes.js'
import settingsRoutes from './modules/settings/settings.routes.js'
import uploadRoutes from './modules/uploads/upload.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/categories', categoryRoutes)
router.use('/products', productRoutes)
router.use('/orders', orderRoutes)
router.use('/settings', settingsRoutes)
router.use('/uploads', uploadRoutes)

export default router