import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: { en: { type: String, required: true }, ar: String },
  slug: { type: String, required: true, unique: true, lowercase: true },
  image: { url: String, publicId: String },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Category', categorySchema)
