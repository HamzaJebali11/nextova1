import mongoose from 'mongoose'

// Extra information about a customer, keyed by the last 8 digits of the phone number
// (the customer list itself is built from the orders; this only holds what you add by hand).
const customerSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, match: /^\d{8}$/ }, // last 8 digits
  phone: String,          // +974XXXXXXXX as typed when the record was made
  notes: { type: String, maxlength: 1000 },
  tags: [{ type: String, trim: true, maxlength: 30 }],
  optOut: { type: Boolean, default: false },   // do not send marketing messages
  blocked: { type: Boolean, default: false },  // block list: new orders get the "Blocked" flag
  blockNote: { type: String, maxlength: 300 },
  blockedAt: Date,
  blockedBy: String,
}, { timestamps: true })

customerSchema.index({ blocked: 1 })

export default mongoose.model('Customer', customerSchema)
