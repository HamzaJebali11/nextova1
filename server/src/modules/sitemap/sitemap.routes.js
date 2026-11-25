import { Router } from 'express'
import Product from '../products/product.model.js'
import Category from '../categories/category.model.js'
import Page from '../pages/page.model.js'
import { asyncHandler } from '../../utils/asyncHandler.js'

// Public sitemap for search engines: /api/v1/sitemap.xml (listed in the website's robots.txt).
// Website address: SITE_URL, else the first address in CLIENT_URL.
const router = Router()
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
let cache = { at: 0, xml: '' }

router.get('/', asyncHandler(async (req, res) => {
  if (Date.now() - cache.at > 60 * 60 * 1000) {
    const site = (process.env.SITE_URL || (process.env.CLIENT_URL || '').split(',')[0] || '').trim().replace(/\/+$/, '')
    const [products, categories, pages] = await Promise.all([
      Product.find({ isActive: true }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
      Page.find({ isActive: true }).select('slug updatedAt').lean(),
    ])
    const url = (path, d) => `<url><loc>${esc(site + path)}</loc>${d ? `<lastmod>${new Date(d).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`
    cache = {
      at: Date.now(),
      xml: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [
        url('/'), url('/shop'),
        ...categories.map((c) => url(`/shop?category=${encodeURIComponent(c.slug)}`, c.updatedAt)),
        ...products.map((p) => url(`/product/${encodeURIComponent(p.slug)}`, p.updatedAt)),
        ...pages.map((p) => url(`/page/${encodeURIComponent(p.slug)}`, p.updatedAt)),
      ].join('\n') + '\n</urlset>\n',
    }
  }
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(cache.xml)
}))

export default router
