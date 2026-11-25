import mongoose from 'mongoose'

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: String,
  price: Number,
  stock: { type: Number, default: 0 },
  image: String,
})

const angleSchema = new mongoose.Schema({
  slug: { type: String, required: true, lowercase: true, trim: true, match: [/^[a-z0-9][a-z0-9-]{0,29}$/, 'Slug: letters, numbers and - only'] },
  headline: { en: String, ar: String },
  subheadline: { en: String, ar: String },
  bullets: { en: [String], ar: [String] },
  image: String, // optional hero picture (shown first in the gallery)
}, { _id: false })

const productSchema = new mongoose.Schema({
  name: { en: { type: String, required: true }, ar: String },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { en: String, ar: String },
  // short benefit line shown under the title on the product page (first screen on phones)
  benefit: { en: String, ar: String },
  // optional per-product text for the "Delivery information" / "Returns" accordions (else the Settings text)
  deliveryInfo: { en: String, ar: String },
  returnsInfo: { en: String, ar: String },
  // pictures that replace the text description on the product page (one set per language)
  // each picture can have an optional caption (shown in the white card beside it)
  descriptionImages: {
    en: [{ url: String, publicId: String, title: { en: String, ar: String }, text: { en: String, ar: String } }],
    ar: [{ url: String, publicId: String, title: { en: String, ar: String }, text: { en: String, ar: String } }],
  },
  // optional vertical (TikTok-format) video: how to use it / see it in action
  video: { url: String, publicId: String },
  // where the video sits in the product gallery: first, second (default) or last slide
  videoPosition: { type: String, enum: ['first', 'second', 'last'], default: 'second' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  images: [{ url: String, publicId: String }],

  price: { type: Number, required: true, min: 0 },
  compareAtPrice: Number,
  costPrice: { type: Number, min: 0, default: 0, select: false }, // private: never sent to customers
  // units bought for the current batch: product ad spend is spread over these (see utils/realCost.js).
  // No default on purpose: when it is empty, stock + soldCount is used, so existing products need no migration.
  unitsPurchased: { type: Number, min: 0, select: false },
  sku: String,
  stock: { type: Number, default: 0, min: 0 },
  lowStockAlert: { type: Number, default: 5 },
  variants: [variantSchema],

  // pack offers: price is the TOTAL for that many units (qty 1 is the normal price)
  packs: [{
    qty: { type: Number, required: true, min: 2 },
    price: { type: Number, required: true, min: 0 },
    badge: { en: String, ar: String },
  }],

  // "buy this, get another product free"
  freeGift: {
    enabled: { type: Boolean, default: false },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    minQty: { type: Number, default: 1, min: 1 },
    qty: { type: Number, default: 1, min: 1 },
  },
    defaultQty: { type: Number, default: 1, min: 1, max: 20 }, // pack preselected when the page opens (1 = none)

  attributes: { type: Map, of: String },
  tags: [String],

  faqs: [{ q: { en: String, ar: String }, a: { en: String, ar: String } }],
  comparison: [{
    feature: { en: String, ar: String },
    ours: { en: String, ar: String },
    theirs: { en: String, ar: String },
  }],

  // AD ANGLES: one landing variant per ad message, opened with ?angle=<slug> (or ?a=<slug>).
  // Only the title block (headline, sub-headline, bullets, hero picture) changes; price, packs and the
  // order form stay identical.
  angles: {
    type: [angleSchema],
    validate: [
      { validator: (list) => list.length <= 10, message: 'Maximum 10 ad angles per product' },
      { validator: (list) => new Set(list.map((a) => a.slug)).size === list.length, message: 'Each ad angle needs its own slug' },
    ],
  },

  isActive: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false },
  soldCount: { type: Number, default: 0 },
  // "Best seller" chip: auto = top sellers of the last 30 days (see utils/bestSellers.js), or always / never
  bestSeller: { type: String, enum: ['auto', 'always', 'never'], default: 'auto' },
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },

  seo: { title: String, description: String },
  extra: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

productSchema.index({ 'name.en': 'text', 'name.ar': 'text', tags: 'text' })

export default mongoose.model('Product', productSchema)