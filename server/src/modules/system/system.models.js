import mongoose from 'mongoose'

// Server and browser errors (no customer data): kept 30 days, and only the last 200 entries.
const errorLogSchema = new mongoose.Schema({
  source: { type: String, enum: ['server', 'client'], required: true },
  fingerprint: { type: String, index: true }, // same kind of error = same fingerprint
  message: { type: String, maxlength: 500 },
  route: { type: String, maxlength: 200 },     // server: METHOD /path ; client: page path
  count: { type: Number, default: 1 },         // repeats of the same error within 10 minutes
  lastAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL: 30 days
})
errorLogSchema.index({ lastAt: -1 })
export const ErrorLog = mongoose.model('ErrorLog', errorLogSchema)

// what the scheduler / alerts already did (one document per job run) so nothing is sent twice, even after a restart
const jobRunSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g. report:week:2026-11-21, alert:new-error:<fp>:2026-11-25T14
  result: String,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 },
})
export const JobRun = mongoose.model('JobRun', jobRunSchema)

// "this kind of error was seen before" (kept a year, so a "new kind of error" alert is really new)
const errorKindSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true },
  firstAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 },
})
export const ErrorKind = mongoose.model('ErrorKind', errorKindSchema)
