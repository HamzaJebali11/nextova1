import mongoose from 'mongoose'

const pageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  title: { en: { type: String, required: true }, ar: String },
  content: { en: String, ar: String },
  isActive: { type: Boolean, default: false },
  showInFooter: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('Page', pageSchema)