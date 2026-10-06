import jwt from 'jsonwebtoken'
import Admin from '../modules/auth/admin.model.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Not authorized' })

  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET)
    const admin = await Admin.findById(id)
    if (!admin || !admin.isActive) throw new Error('inactive')
    req.admin = admin
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
})

export const ownerOnly = (req, res, next) =>
  req.admin?.role === 'owner' ? next() : res.status(403).json({ message: 'Owner access only' })