import mongoose from 'mongoose'

// one record per visitor per day
const visitSchema = new mongoose.Schema({
  day: { type: String, required: true },       // YYYY-MM-DD in Qatar time
  visitorId: { type: String, required: true }, // random id from the visitor's browser
  pageViews: { type: Number, default: 0 },
  landing: String,
  source: String,                              // "facebook / paid", "google.com" or "direct"
  campaign: String,
  device: String,                              // mobile | desktop
  products: [String],                          // product links viewed that day
  createdAt: Date,
})

visitSchema.index({ day: 1, visitorId: 1 }, { unique: true })
visitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 }) // keep 180 days

export default mongoose.model('Visit', visitSchema)