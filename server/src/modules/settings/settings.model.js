import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  storeName: { type: String, default: 'Nextova' },
  legalName: String,
  crNumber: String,
  logoUrl: String,
  currency: { type: String, default: 'QAR' },
  whatsappNumber: String,
  deliveryFee: { type: Number, default: 0 },
  freeDeliveryThreshold: { type: Number, default: 0 },
  shippingCostPerOrder: { type: Number, default: 0 },
  salesPopup: { type: Boolean, default: true },
  // the "before you leave" percentage offer (off until you switch it on)
  exitOffer: {
    enabled: { type: Boolean, default: false },
    percent: { type: Number, default: 10, min: 1, max: 50 },
  },
  // rotating top bar: one message at a time (EN/AR), each can be switched off
  announcements: [{
    en: { type: String, trim: true, maxlength: 140 },
    ar: { type: String, trim: true, maxlength: 140 },
    active: { type: Boolean, default: true },
  }],
  announcementSeconds: { type: Number, default: 4, min: 2, max: 30 },
  // older single message (still shown when the list above is empty)
  announcementBar: {
    enabled: { type: Boolean, default: false },
    en: String,
    ar: String,
  },
  social: { facebook: String, instagram: String, tiktok: String },
  pixelId: String,
    trust: {
    delivery: { en: String, ar: String },
    payment: { en: String, ar: String },
    returns: { en: String, ar: String },
    support: { en: String, ar: String },
  },
    clarityId: String,
  // social proof bar on product pages: hidden until a product has at least this many units bought
  proofMinBought: { type: Number, default: 5, min: 1, max: 100000 },
  // product page: "Order within 3h 12m and get it within 2 working days" (Qatar time cut-off, HH:MM)
  deliveryCountdown: { type: Boolean, default: true },
  deliveryCutoff: { type: String, default: '17:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  // most pieces of ONE product in one order (storefront quantity and server check); 0 = only the stock limits it
  maxPerOrder: { type: Number, default: 10, min: 0, max: 100 },
  // product page: "Only N left in stock" bar shows when the real stock is at or below this number
  stockBarMax: { type: Number, default: 15, min: 1, max: 1000 },
  // product page accordions (a product can override them)
  deliveryInfo: { en: String, ar: String },
  returnsInfo: { en: String, ar: String },
  // admin: play a soft sound when a new website order arrives
  orderSound: { type: Boolean, default: false },
  // new orders with a flag (failed before, duplicate, blocked phone) get the status "Needs confirmation"
  holdFlagged: { type: Boolean, default: false },
  // Reports (cash view): what one delivery costs you, and what a failed delivery costs you
  deliveryCostPerOrder: { type: Number, default: 0, min: 0 },
  failedDeliveryCost: { type: Number, default: 0, min: 0 },
  // weekly (Sunday 08:00) and monthly (day 1, 08:00) profit report by email, Qatar time
  reportEmail: {
    to: { type: String, trim: true, maxlength: 200 },
    weekly: { type: Boolean, default: false },
    monthly: { type: Boolean, default: false },
  },
  // error and "no orders" alerts by email (at most one email per kind per hour, never customer details)
  alerts: {
    enabled: { type: Boolean, default: false },
    email: { type: String, trim: true, maxlength: 200 },
    noOrderHours: { type: Number, default: 0, min: 0, max: 720 }, // 0 = off
  },
  // home page first screen (hero product card, Step 39): auto = up to 5 visible in-stock products, best sellers
  // first then newest; manual = the products picked in the admin, in that order (hidden / sold-out ones skipped)
  hero: {
    mode: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    products: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], validate: [(a) => a.length <= 5, 'At most 5 hero products'] },
    seconds: { type: Number, default: 3, min: 2, max: 10 },
  },
  features: { type: Map, of: Boolean },
  extra: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

export default mongoose.model('Settings', settingsSchema)