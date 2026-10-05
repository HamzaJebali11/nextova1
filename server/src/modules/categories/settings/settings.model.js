import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  storeName: { type: String, default: 'Nextova' },
  currency: { type: String, default: 'QAR' },
  whatsappNumber: String,
  deliveryFee: { type: Number, default: 0 },
  freeDeliveryThreshold: { type: Number, default: 0 },
  announcementBar: {
    enabled: { type: Boolean, default: false },
    en: String,
    ar: String,
  },
  social: { facebook: String, instagram: String, tiktok: String },
  pixelId: String,
  features: { type: Map, of: Boolean },         // feature flags, switch features on/off
  extra: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

export default mongoose.model('Settings', settingsSchema)