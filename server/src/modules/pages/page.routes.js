import { Router } from 'express'
import Page from './page.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { protect } from '../../middleware/auth.js'
import { uniqueSlug } from '../../utils/slug.js'

const router = Router()

// public: footer links
router.get('/', asyncHandler(async (req, res) => {
  res.json(
    await Page.find({ isActive: true, showInFooter: true })
      .sort({ sortOrder: 1, createdAt: 1 }).select('slug title').lean())
}))

// admin: every page, including drafts
router.get('/admin/all', protect, asyncHandler(async (req, res) => {
  res.json(await Page.find().sort({ sortOrder: 1, createdAt: 1 }).lean())
}))

// public: one published page
router.get('/:slug', asyncHandler(async (req, res) => {
  const page = await Page.findOne({ slug: req.params.slug, isActive: true }).lean()
  if (!page) return res.status(404).json({ message: 'Page not found' })
  res.json(page)
}))

router.post('/', protect, asyncHandler(async (req, res) => {
  const slug = await uniqueSlug(Page, req.body.slug || req.body.title?.en)
  res.status(201).json(await Page.create({ ...req.body, slug }))
}))

router.put('/:id', protect, asyncHandler(async (req, res) => {
  const update = { ...req.body }
  if (update.slug) update.slug = await uniqueSlug(Page, update.slug, req.params.id)
  const page = await Page.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after', runValidators: true })
  if (!page) return res.status(404).json({ message: 'Page not found' })
  res.json(page)
}))

router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const page = await Page.findByIdAndDelete(req.params.id)
  if (!page) return res.status(404).json({ message: 'Page not found' })
  res.json({ message: 'Deleted' })
}))

export default router