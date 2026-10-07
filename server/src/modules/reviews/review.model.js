import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 100 },
  comment: { type: String, trim: true, maxlength: 1000 },
  images: [{ url: String, publicId: String }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  source: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  verified: { type: Boolean, default: false },
  ip: String,
}, { timestamps: true })

export default mongoose.model('Review', reviewSchema)