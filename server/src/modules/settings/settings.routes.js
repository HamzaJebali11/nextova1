import { Router } from 'express'
import Settings from './settings.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect, ownerOnly } from '../../middleware/auth.js'

const router = Router()

// READ ONLY: opening a page never creates or rewrites the settings document.
// When it does not exist yet, the schema defaults are returned (nothing is saved until you press Save).
const getSettings = async () =>
  (await Settings.findOne({ key: 'main' })) || new Settings({ key: 'main' })

// public: only what the storefront needs
router.get('/', asyncHandler(async (req, res) => {
  const s = await getSettings()
  res.json({
    storeName: s.storeName,
    legalName: s.legalName,
    crNumber: s.crNumber,
    logoUrl: s.logoUrl,
    currency: s.currency,
    whatsappNumber: s.whatsappNumber,
    deliveryFee: s.deliveryFee,
    freeDeliveryThreshold: s.freeDeliveryThreshold,
    salesPopup: s.salesPopup !== false,
    exitOffer: { enabled: !!s.exitOffer?.enabled, percent: s.exitOffer?.percent || 10 },
    announcementBar: s.announcementBar,
    announcements: (s.announcements || []).filter((a) => a.active !== false && (a.en || a.ar)).map((a) => ({ en: a.en, ar: a.ar })),
    announcementSeconds: s.announcementSeconds || 4,
    deliveryCountdown: s.deliveryCountdown !== false,
    deliveryCutoff: s.deliveryCutoff || '17:00',
    stockBarMax: s.stockBarMax || 15,
    deliveryInfo: s.deliveryInfo,
    returnsInfo: s.returnsInfo,
    social: s.social,
    pixelId: s.pixelId,
        trust: s.trust,
        clarityId: s.clarityId,
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