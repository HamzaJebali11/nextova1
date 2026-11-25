import mongoose from 'mongoose'

// PLANNER: your own what-if numbers for a product (costs, pack prices, sales mix…).
// It is a separate collection: nothing here is ever read by products, orders, profit or reports.
const planSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true }, // one plan per product
  inputs: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

export default mongoose.model('Plan', planSchema)
