import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import routes from './routes.js'
import { notFound, errorHandler } from './middleware/error.js'

dotenv.config()
const app = express()

app.set('trust proxy', 1) // needed on Render/Railway so rate limiting sees the real visitor IP
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', store: 'Nextova' })
})

app.use('/api/v1', routes)
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`))
})