import mongoose from 'mongoose'

// "Live visitors" (Step 42): ONE small document per anonymous visitor, refreshed by the storefront heartbeat.
// _id = the anonymous random visitor id the shop already uses (nx_vid); no name, phone, address or IP.
// The TTL index removes a document 10 minutes after its last heartbeat, so the collection cleans itself.
// autoIndex / autoCreate are off: nothing is created or written when the server starts; the collection and
// the TTL index are created on the first heartbeat (see ensureLive in stats.routes.js).
export const LIVE_TTL_SECONDS = 10 * 60

const liveSchema = new mongoose.Schema({
  _id: { type: String },                                   // anonymous visitor id
  page: { type: String, enum: ['home', 'shop', 'category', 'product', 'cart', 'checkout', 'confirmation', 'other'] },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // only on a product page
  device: { type: String, enum: ['phone', 'tablet', 'desktop'] },
  lastSeen: { type: Date },
}, { versionKey: false, autoIndex: false, autoCreate: false, collection: 'livevisitors' })

liveSchema.index({ lastSeen: 1 }, { expireAfterSeconds: LIVE_TTL_SECONDS })

export default mongoose.model('LiveVisitor', liveSchema)
