import mongoose from 'mongoose'

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: String,
  price: Number,
  stock: { type: Number, default: 0 },
  image: String,
})

const productSchema = new mongoose.Schema({
  name: { en: { type: String, required: true }, ar: String },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { en: String, ar: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  images: [{ url: String, publicId: String }],

  price: { type: Number, required: true, min: 0 },
  compareAtPrice: Number,
  costPrice: { type: Number, min: 0, default: 0, select: false }, // private: never sent to customers
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

  attributes: { type: Map, of: String },
  tags: [String],

  faqs: [{ q: { en: String, ar: String }, a: { en: String, ar: String } }],
  comparison: [{
    feature: { en: String, ar: String },
    ours: { en: String, ar: String },
    theirs: { en: String, ar: String },
  }],

  isActive: { type: Boolean, default: true, index: true },
  isFeatured: { type: Boolean, default: false },
  soldCount: { type: Number, default: 0 },
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },

  seo: { title: String, description: String },
  extra: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

productSchema.index({ 'name.en': 'text', 'name.ar': 'text', tags: 'text' })

export default mongoose.model('Product', productSchema)