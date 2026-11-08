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
  features: { type: Map, of: Boolean },
  extra: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

export default mongoose.model('Settings', settingsSchema)