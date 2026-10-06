import mongoose from 'mongoose'
import Counter from './counter.model.js'

export const ORDER_STATUSES = [
  'new', 'confirmed', 'processing', 'out_for_delivery',
  'delivered', 'cancelled', 'returned',
]

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  variantName: String,
  price: Number,
  qty: { type: Number, min: 1 },
  image: String,
}, { _id: false })

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    area: String,
    address: { type: String, required: true },
    notes: String,
  },
  items: [itemSchema],
  subtotal: Number,
  discount: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  total: Number,
  couponCode: String,

  paymentMethod: { type: String, default: 'cod' },
  status: { type: String, enum: ORDER_STATUSES, default: 'new', index: true },
  statusHistory: [{
    status: String,
    note: String,
    at: { type: Date, default: Date.now },
  }],

  source: { type: String, default: 'website' },
  utm: { source: String, medium: String, campaign: String },
  adminNotes: String,
  ip: String,
}, { timestamps: true })

orderSchema.pre('save', async function () {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      'order', { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true }
    )
    this.orderNumber = `NX-${1000 + counter.seq}`
    this.statusHistory.push({ status: this.status, note: 'Order created' })
  }
})

export default mongoose.model('Order', orderSchema)