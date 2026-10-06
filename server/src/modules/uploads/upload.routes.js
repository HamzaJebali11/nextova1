import { Router } from 'express'
import crypto from 'crypto'
import { protect } from '../../middleware/auth.js'

const router = Router()

router.post('/sign', protect, (req, res) => {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: secret,
  } = process.env

  if (!cloudName || !apiKey || !secret) {
    return res.status(500).json({ message: 'Cloudinary is not configured in server/.env' })
  }

  const folder = 'nextova/products'
  const timestamp = Math.round(Date.now() / 1000)
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex')

  res.json({ cloudName, apiKey, timestamp, folder, signature })
})

export default router