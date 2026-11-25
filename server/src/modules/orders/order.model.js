import mongoose from 'mongoose'
import Counter from './counter.model.js'
import { sendOrderWhatsApp } from '../../utils/whatsapp.js'

// 'returned' is the failed-delivery outcome (shown as "Failed / returned"); 'on_hold' = "Needs confirmation"
// (only used when Settings > "Put flagged orders on hold" is on)
export const ORDER_STATUSES = [
  'new', 'on_hold', 'confirmed', 'processing', 'out_for_delivery',
  'delivered', 'cancelled', 'returned',
]

// why a delivery failed (saved on the order when it is set to "Failed / returned")
export const FAIL_REASONS = ['refused', 'no_answer', 'wrong_address', 'changed_mind', 'other']

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  variantName: String,
  price: Number,
  cost: { type: Number, default: 0 },   // your cost per unit, saved at the time of the order
  qty: { type: Number, min: 1 },
  image: String,
}, { _id: false })

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    area: String,
    zone: { type: String, index: true },
    street: String,
    building: String,
    address: String,   // landmark / extra details (older orders: the full address)
    notes: String,
  },
  items: [itemSchema],
  subtotal: Number,
  discount: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  total: Number,
  couponCode: String,

  shippingCost: { type: Number, default: 0 },   // what delivery costs YOU
  deliveredAt: Date,
  stockTaken: { type: Boolean, default: true }, // false for past sales you enter by hand
  // true while the order's units are back in stock (cancelled / failed with "return the units to stock").
  // Older orders do not have it: a closed older order counts as "units back in stock".
  stockReleased: Boolean,

  // failed delivery: why, when and who (set with the status "Failed / returned")
  failure: {
    reason: { type: String, enum: FAIL_REASONS },
    note: String,
    at: Date,
    by: String,
    restocked: Boolean, // the units were returned to stock
  },

  // checks made when the order was created (never shown to the customer, never block the order)
  flags: {
    failedBefore: { type: Number, default: 0 }, // failed orders already on this phone number
    duplicate: { type: Boolean, default: false }, // another order from this phone in the last 24 hours
    duplicateOf: String,                        // its order number
    blocked: { type: Boolean, default: false },  // the phone is on your block list
    held: { type: Boolean, default: false },     // put on "Needs confirmation" because of the flags
  },

  // the automatic WhatsApp message: sent | delivered | read | failed
  whatsapp: {
    messageId: String,
    status: String,
    error: String,
    sentAt: Date,
  },
  // the customer's location, received by WhatsApp
  location: {
    lat: Number,
    lng: Number,
    url: String,
    name: String,
    receivedAt: Date,
  },

  paymentMethod: { type: String, default: 'cod' },
  status: { type: String, enum: ORDER_STATUSES, default: 'new', index: true },
  statusHistory: [{
    status: String,
    note: String,
    by: String, // admin who changed it
    at: { type: Date, default: Date.now },
  }],

  source: { type: String, default: 'website' },
  utm: { source: String, medium: String, campaign: String },
  // where the customer came from: first ad landing in the last 30 days (see client/src/lib/utm.js).
  // Names come from the ad's URL parameters: campaign = utm_campaign, ad set = utm_term, ad = utm_content.
  // Older orders do not have it and are left as they are.
  attribution: {
    source: String,      // utm_source
    medium: String,      // utm_medium
    campaign: String,    // utm_campaign (campaign name)
    content: String,     // utm_content (ad name)
    term: String,        // utm_term (ad set name)
    campaignId: String,  // campaign_id
    adsetId: String,     // adset_id
    adId: String,        // ad_id
    fbclid: String,      // Meta click id (not an ad id)
    ttclid: String,      // TikTok click id
    fbp: String,         // _fbp cookie (Meta browser id)
    fbc: String,         // _fbc cookie (Meta click cookie)
    landing: String,     // first page opened
    referrer: String,    // site the visitor came from
    firstSeenAt: Date,   // when the first touch was saved
  },
  visitorId: String,     // anonymous browser id used by the visitor counter
  // the sales event that was live when the order was placed (a label only: prices are never changed by events)
  event: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesEvent' },
    name: String,
  },
  // the ad angle page the customer ordered from (?angle=<slug>); older orders do not have it
  angle: {
    slug: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  },
  adminNotes: String,
  ip: String,
}, { timestamps: true })

orderSchema.index({ createdAt: -1 })
orderSchema.index({ source: 1, createdAt: -1 })
orderSchema.index({ 'items.product': 1, createdAt: -1 }) // Orders page: filter by product
orderSchema.index({ status: 1, deliveredAt: -1 }) // reports: delivered in a period
orderSchema.index({ status: 1, 'failure.at': -1 })  // reports: failed in a period
orderSchema.index({ 'failure.reason': 1, createdAt: -1 }, { partialFilterExpression: { 'failure.reason': { $exists: true } } }) // filter by failed reason

orderSchema.pre('save', async function () {
  this.$locals.wasNew = this.isNew
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      'order', { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true }
    )
    this.orderNumber = `NX-${1000 + counter.seq}`
    this.statusHistory.push({ status: this.status, note: 'Order created' })
  }
})

// after a NEW order is saved: close the customer's unfinished-order lead and send the automatic WhatsApp message
orderSchema.post('save', async function (doc) {
  if (!doc.$locals?.wasNew) return
  try {
    await mongoose.model('Lead').updateMany({ phone: doc.customer.phone }, { status: 'ordered' })
  } catch {
    // leads are optional: never block an order because of them
  }
  if (doc.$locals?.skipNotify) return // orders you register yourself do not send the automatic message
  sendOrderWhatsApp(doc).catch((e) => console.error('WhatsApp error:', e.message))
})

export default mongoose.model('Order', orderSchema)