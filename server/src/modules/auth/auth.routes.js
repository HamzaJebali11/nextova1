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

// Per account (not only per IP): after 5 wrong passwords for the same e-mail, that e-mail is locked for 1 minute,
// then 2, 4, 8, up to 15 minutes for every further failure (from any IP). Works the same for e-mails that do not
// exist, so the lock does not reveal which accounts are real. A correct login clears it. Kept in memory (one server).
const FREE_TRIES = 5
const failures = new Map() // email -> { n, until }
const lockOf = (key) => {
  const f = failures.get(key)
  return f && f.until > Date.now() ? f.until : 0
}
function failed(key) {
  const f = failures.get(key) || { n: 0, until: 0 }
  f.n += 1
  if (f.n >= FREE_TRIES) f.until = Date.now() + Math.min(15, 2 ** (f.n - FREE_TRIES)) * 60 * 1000
  failures.set(key, f)
  if (failures.size > 5000) failures.delete(failures.keys().next().value) // never grows without limit
}
// a real bcrypt hash of a random password: unknown e-mails take as long as wrong passwords (no account guessing by timing)
const DUMMY_HASH = bcrypt.hashSync(Math.random().toString(36), 12) // same cost as the real hashes (scripts/createAdmin.js)

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const key = String(email || '').toLowerCase().slice(0, 200)
  if (lockOf(key)) return res.status(429).json({ message: 'Too many login attempts, try again in a few minutes' })
  const admin = await Admin.findOne({ email: key }).select('+password')
  const match = await bcrypt.compare(String(password || ''), admin?.password || DUMMY_HASH)
  const ok = admin && admin.isActive && match
  if (!ok) {
    failed(key)
    return res.status(401).json({ message: 'Wrong email or password' })
  }
  failures.delete(key)

  const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' })
  res.json({ token, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } })
}))

router.get('/me', protect, (req, res) => {
  const { _id, name, email, role } = req.admin
  res.json({ id: _id, name, email, role })
})

export default router