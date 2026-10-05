import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner', 'staff'], default: 'owner' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Admin', adminSchema)