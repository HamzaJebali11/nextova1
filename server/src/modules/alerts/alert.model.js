import mongoose from 'mongoose'

const alertSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  variantName: { type: String, default: null },
  phone: { type: String, required: true },
  lang: { type: String, enum: ['en', 'ar'], default: 'en' },
  notifiedAt: Date,
  createdAt: { type: Date, default: Date.now },
})

alertSchema.index({ product: 1, variantName: 1, phone: 1 }, { unique: true })
// requests delete themselves after 180 days
alertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 })

export default mongoose.model('Alert', alertSchema)