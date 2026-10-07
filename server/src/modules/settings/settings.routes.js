import { Router } from 'express'
import Settings from './settings.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect, ownerOnly } from '../../middleware/auth.js'

const router = Router()

const getSettings = () =>
  Settings.findOneAndUpdate({ key: 'main' }, {}, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })

// public: only what the storefront needs
router.get('/', asyncHandler(async (req, res) => {
  const s = await getSettings()
  res.json({
    storeName: s.storeName,
    logoUrl: s.logoUrl,
    currency: s.currency,
    whatsappNumber: s.whatsappNumber,
    deliveryFee: s.deliveryFee,
    freeDeliveryThreshold: s.freeDeliveryThreshold,
    salesPopup: s.salesPopup !== false,
    announcementBar: s.announcementBar,
    social: s.social,
    pixelId: s.pixelId,
  })
}))

// private: everything, including costs
router.get('/admin', protect, asyncHandler(async (req, res) => {
  res.json(await getSettings())
}))

router.put('/', protect, ownerOnly, asyncHandler(async (req, res) => {
  const { key, _id, ...update } = req.body
  const s = await Settings.findOneAndUpdate({ key: 'main' }, { $set: update },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true })
  res.json(s)
}))

export default router