import mongoose from 'mongoose'

// SALES EVENT (for example Black Friday): DISPLAY ONLY.
// It is a message shown to visitors. It never changes, calculates or reduces any price, pack price,
// cart total, order total, profit or report. minPct / maxPct are just the text "X% to Y% off".
//
// Dates are Qatar calendar days (Asia/Qatar, UTC+3), both inclusive:
// it starts at 00:00:00 on startDate and ends at 23:59:59.999 on endDate.

const DAY = /^\d{4}-\d{2}-\d{2}$/

const salesEventSchema = new mongoose.Schema({
  name: { en: { type: String, required: true, trim: true, maxlength: 60 }, ar: { type: String, trim: true, maxlength: 60 } },
  startDate: { type: String, required: true, match: DAY },
  endDate: { type: String, required: true, match: DAY },
  minPct: { type: Number, default: 0, min: 0, max: 99 },  // display text only
  maxPct: { type: Number, required: true, min: 1, max: 99 }, // display text only
  active: { type: Boolean, default: true },
  // exact moments, worked out from the dates above (Qatar time)
  startsAt: Date,
  endsAt: Date,
}, { timestamps: true })

salesEventSchema.pre('validate', function () {
  if (DAY.test(this.startDate || '')) this.startsAt = new Date(`${this.startDate}T00:00:00.000+03:00`)
  if (DAY.test(this.endDate || '')) this.endsAt = new Date(`${this.endDate}T23:59:59.999+03:00`)
  if (this.startsAt && this.endsAt && this.endsAt < this.startsAt) this.invalidate('endDate', 'The end date must be on or after the start date')
  if (this.minPct > this.maxPct) this.invalidate('minPct', '"From" % must not be above "to" %')
})

export default mongoose.model('SalesEvent', salesEventSchema)
