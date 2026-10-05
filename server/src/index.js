import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'   // add with the other imports

dotenv.config()
const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json())
app.use(morgan('dev'))

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', store: 'Nextova' })
})

const PORT = process.env.PORT || 5000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`))
})