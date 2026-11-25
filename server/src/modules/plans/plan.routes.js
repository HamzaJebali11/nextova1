import { Router } from 'express'
import mongoose from 'mongoose'
import Plan from './plan.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { httpError } from '../../utils/httpError.js'
import { protect } from '../../middleware/auth.js'

// Admin only. Plans are calculations for you: they never change products, orders or reports.
const router = Router()
router.use(protect)

// the planner fields that can be saved (numbers, or '' for "left empty")
const FIELDS = [
  'units', 'factoryPerUnit', 'packagingPerUnit', 'cartons', 'unitsPerCarton', 'kgPerCarton',
  'shippingTotal', 'shippingPerKg', 'deliveryPerOrder', 'failedCost', 'otherCosts',
  'price1', 'price2', 'price3', 'mix1', 'mix2', 'mix3', 'deliveryRate', 'targetPct',
]

function clean(body = {}) {
  const out = {}
  for (const k of FIELDS) {
    const v = body[k]
    if (v === '' || v === null || v === undefined) out[k] = ''
    else {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0 || n > 1e9) throw httpError(400, `Invalid value for ${k}`)
      out[k] = n
    }
  }
  return out
}

const validId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid product')
  return id
}

// which products already have a plan
router.get('/', asyncHandler(async (req, res) => {
  res.json(await Plan.find().select('product updatedAt').lean())
}))

router.get('/:productId', asyncHandler(async (req, res) => {
  const plan = await Plan.findOne({ product: validId(req.params.productId) }).lean()
  res.json(plan || null)
}))

router.put('/:productId', asyncHandler(async (req, res) => {
  const plan = await Plan.findOneAndUpdate(
    { product: validId(req.params.productId) },
    { $set: { inputs: clean(req.body?.inputs) } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean()
  res.json(plan)
}))

export default router
