import { Router } from 'express'
import AdSpend from './adspend.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

const router = Router()
router.use(protect)

router.get('/', asyncHandler(async (req, res) => {
  res.json(await AdSpend.find().sort({ startDate: -1 }).limit(200).lean())
}))

router.post('/', asyncHandler(async (req, res) => {
  const { startDate, days = 7, amount, platform, note } = req.body
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) throw httpError(400, 'Choose a start date')
  const amt = Number(amount)
  const d = Math.round(Number(days))
  if (!Number.isFinite(amt) || amt < 0) throw httpError(400, 'Enter a valid amount')
  if (!Number.isFinite(d) || d < 1 || d > 366) throw httpError(400, 'Days must be between 1 and 366')

  const doc = await AdSpend.create({
    startDate: new Date(`${startDate}T00:00:00+03:00`), // Qatar midnight
    days: d, amount: amt, platform, note,
  })
  res.status(201).json(doc)
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const doc = await AdSpend.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Entry not found' })
  res.json({ message: 'Deleted' })
}))

export default router