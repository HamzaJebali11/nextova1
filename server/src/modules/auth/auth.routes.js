import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import Admin from './admin.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many login attempts, try again in 15 minutes' },
})

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const admin = await Admin.findOne({ email: String(email || '').toLowerCase() }).select('+password')
  const ok = admin && admin.isActive && (await bcrypt.compare(String(password || ''), admin.password))
  if (!ok) return res.status(401).json({ message: 'Wrong email or password' })

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } })
}))

router.get('/me', protect, (req, res) => {
  const { _id, name, email, role } = req.admin
  res.json({ id: _id, name, email, role })
})

export default router