import { Router } from 'express'
import Category from './category.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'
import { uniqueSlug } from '../../utils/slug.js'

const router = Router()

// public: active categories
router.get('/', asyncHandler(async (req, res) => {
  const items = await Category.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean()
  res.json(items)
}))

// admin: all categories
router.get('/admin/all', protect, asyncHandler(async (req, res) => {
  res.json(await Category.find().sort({ sortOrder: 1, createdAt: 1 }).lean())
}))

router.post('/', protect, asyncHandler(async (req, res) => {
  const slug = await uniqueSlug(Category, req.body.slug || req.body.name?.en)
  res.status(201).json(await Category.create({ ...req.body, slug }))
}))

router.put('/:id', protect, asyncHandler(async (req, res) => {
  const update = { ...req.body }
  if (update.slug) update.slug = await uniqueSlug(Category, update.slug, req.params.id)
  const doc = await Category.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
  if (!doc) return res.status(404).json({ message: 'Category not found' })
  res.json(doc)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const doc = await Category.findByIdAndDelete(req.params.id)
  if (!doc) return res.status(404).json({ message: 'Category not found' })
  res.json({ message: 'Deleted' })
}))

export default router