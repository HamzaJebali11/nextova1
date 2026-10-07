import { Router } from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { protect } from '../../middleware/auth.js'

const router = Router()

const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: { message: 'Too many uploads, please try again later' },
})

function config() {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env
  if (!cloudName || !apiKey || !secret) return null
  return { cloudName, apiKey, secret }
}

function sign(params, secret) {
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  return crypto.createHash('sha1').update(toSign + secret).digest('hex')
}

// admin uploads (products, logo, categories)
router.post('/sign', protect, (req, res) => {
  const c = config()
  if (!c) return res.status(500).json({ message: 'Cloudinary is not configured in server/.env' })
  const folder = 'nextova/products'
  const timestamp = Math.round(Date.now() / 1000)
  res.json({
    cloudName: c.cloudName, apiKey: c.apiKey, timestamp, folder,
    signature: sign({ folder, timestamp }, c.secret),
  })
})

// customer review photos (images only, limited per device)
router.post('/review-sign', publicLimiter, (req, res) => {
  const c = config()
  if (!c) return res.status(500).json({ message: 'Uploads are not available right now' })
  const folder = 'nextova/reviews'
  const allowedFormats = 'jpg,jpeg,png,webp'
  const timestamp = Math.round(Date.now() / 1000)
  res.json({
    cloudName: c.cloudName, apiKey: c.apiKey, timestamp, folder, allowedFormats,
    signature: sign({ allowed_formats: allowedFormats, folder, timestamp }, c.secret),
  })
})

export default router