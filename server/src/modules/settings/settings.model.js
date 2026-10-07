import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  storeName: { type: String, default: 'Nextova' },
  logoUrl: String,
  currency: { type: String, default: 'QAR' },
  whatsappNumber: String,
  deliveryFee: { type: Number, default: 0 },
  freeDeliveryThreshold: { type: Number, default: 0 },
  salesPopup: { type: Boolean, default: true },
  announcementBar: {
    enabled: { type: Boolean, default: false },
    en: String,
    ar: String,
  },
    shippingCostPerOrder: { type: Number, default: 0 },
  social: { facebook: String, instagram: String, tiktok: String },
  pixelId: String,
  features: { type: Map, of: Boolean },
  extra: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

export default mongoose.model('Settings', settingsSchema)