import mongoose from 'mongoose'

const leadSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, trim: true, maxlength: 80 },
  area: String,
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    variantName: String,
    qty: Number,
  }],
  total: Number,
  utm: { source: String, medium: String, campaign: String },
  status: { type: String, enum: ['new', 'contacted', 'ordered', 'ignored'], default: 'new', index: true },
  ip: String,
}, { timestamps: true })

// data minimisation: unfinished leads are deleted automatically 30 days after the last activity
leadSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 })

export default mongoose.model('Lead', leadSchema)