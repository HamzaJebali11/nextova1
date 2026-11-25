import fs from 'node:fs'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import routes from './routes.js'
import { notFound, errorHandler } from './middleware/error.js'
import { recordError } from './utils/errorLog.js'
import { startScheduler } from './jobs/scheduler.js'

dotenv.config()
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is missing or too short (use at least 32 random characters). See server/.env.example.')
  process.exit(1)
}
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing. See server/.env.example.')
  process.exit(1)
}
const app = express()

// CLIENT_URL can hold several addresses separated by commas
const origins = (process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean)

app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: origins }))
// rawBody is kept so the WhatsApp webhook signature can be verified
app.use(express.json({ limit: '1mb', verify: (req, res, buf) => { req.rawBody = buf } }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// uptime check (UptimeRobot etc.): no secrets, no rate limit, 503 when the database is down
const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version || '1.0.0' } catch { return '1.0.0' }
})()
async function health(req, res) {
  let db = mongoose.connection.readyState === 1
  if (db) {
    try {
      await Promise.race([mongoose.connection.db.admin().ping(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))])
    } catch { db = false }
  }
  res.set('Cache-Control', 'no-store')
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'error', db: db ? 'up' : 'down', time: new Date().toISOString(), version: VERSION })
}
app.get('/health', health)
app.get('/api/v1/health', health)

// general protection against floods (login and orders have their own stricter limits)
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }))

app.use('/api/v1', routes)
app.use(notFound)
app.use(errorHandler)

// errors that escaped every handler: logged in one place (System status), the process keeps running for rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason)
  recordError({ source: 'server', message: `Unhandled rejection: ${reason?.message || reason}`, route: 'process' })
})
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
  recordError({ source: 'server', message: `Uncaught exception: ${err?.message || err}`, route: 'process' })
    .finally(() => setTimeout(() => process.exit(1), 500)) // state is unknown after this: let the host restart the server
})

const PORT = process.env.PORT || 5000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`))
  if (process.env.DISABLE_SCHEDULER !== '1') startScheduler() // weekly / monthly report e-mails and alerts
})