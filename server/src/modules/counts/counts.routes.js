import { Router } from 'express'
import Order from '../orders/order.model.js'
import Lead from '../leads/lead.model.js'
import Review from '../reviews/review.model.js'
import Alert from '../alerts/alert.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

router.get('/', protect, asyncHandler(async (req, res) => {
  const [orders, leads, reviews, waiting] = await Promise.all([
    Order.countDocuments({ status: 'new' }),
    Lead.countDocuments({ status: 'new' }),
    Review.countDocuments({ status: 'pending' }),
    Alert.find({ notifiedAt: null }).select('variantName product').populate('product', 'stock variants').lean(),
  ])

  // customers waiting for a product that is back in stock
  const waitlist = waiting.filter((a) => {
    if (!a.product) return false
    const stock = a.variantName
      ? a.product.variants?.find((v) => v.name === a.variantName)?.stock ?? 0
      : a.product.stock
    return stock > 0
  }).length

  res.json({ orders, leads, reviews, waitlist })
}))

export default router