import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import Admin from '../modules/auth/admin.model.js'

dotenv.config()

const [email, password] = process.argv.slice(2)
if (!email || !password || password.length < 10) {
  console.log('Usage: npm run reset-password -- email newPassword   (password: 10+ characters)')
  process.exit(1)
}

await mongoose.connect(process.env.MONGO_URI)
const admin = await Admin.findOne({ email: email.toLowerCase() })
if (!admin) {
  console.log('No admin found with that email')
} else {
  admin.password = await bcrypt.hash(password, 12)
  await admin.save()
  console.log('Password updated for', email)
}
await mongoose.disconnect()