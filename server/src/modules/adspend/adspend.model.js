import mongoose from 'mongoose'

const adSpendSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },        // first day this spend covers
  days: { type: Number, default: 7, min: 1, max: 366 }, // 7 = a weekly amount, 1 = a daily amount
  amount: { type: Number, required: true, min: 0 },
  platform: { type: String, default: 'Facebook' },
  note: String,
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // optional: spend for one product
}, { timestamps: true })

export default mongoose.model('AdSpend', adSpendSchema)