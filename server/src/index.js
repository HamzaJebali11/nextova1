import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import routes from './routes.js'
import { notFound, errorHandler } from './middleware/error.js'

dotenv.config()
const app = express()

// CLIENT_URL can hold several addresses separated by commas
const origins = (process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean)

app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({ origin: origins }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', store: 'Nextova' })
})

// general protection against floods (login and orders have their own stricter limits)
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }))

app.use('/api/v1', routes)
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`))
})