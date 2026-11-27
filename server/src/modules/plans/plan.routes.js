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

const numOrEmpty = (v, k, max = 1e9) => {
  if (v === '' || v === null || v === undefined) return ''
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > max) throw httpError(400, `Invalid value for ${k}`)
  return n
}

function clean(body = {}) {
  const out = {}
  for (const k of FIELDS) out[k] = numOrEmpty(body[k], k)
  // the pack rows of the product (Step 46): size (pieces), selling price, share of orders %, optional label.
  // Plans saved before have no rows: they keep working from price1..3 / mix1..3 (sizes 1, 2, 3).
  if (body.packRows !== undefined) {
    if (!Array.isArray(body.packRows) || body.packRows.length < 1 || body.packRows.length > 20) throw httpError(400, 'Invalid pack rows')
    out.packRows = body.packRows.map((r, i) => {
      const size = Number(r?.size)
      if (!Number.isInteger(size) || size < 1 || size > 1000) throw httpError(400, `Invalid pack size in row ${i + 1}`)
      return {
        size,
        price: numOrEmpty(r.price, `price of row ${i + 1}`),
        share: numOrEmpty(r.share, `share of row ${i + 1}`, 100),
        label: String(r.label || '').slice(0, 60),
      }
    })
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
