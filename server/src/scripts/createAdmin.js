import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import Admin from '../modules/auth/admin.model.js'

dotenv.config()

const [email, password, name = 'Owner'] = process.argv.slice(2)
if (!email || !password || password.length < 8) {
  console.log('Usage: npm run create-admin -- email password [name]   (password: 8+ characters)')
  process.exit(1)
}

await mongoose.connect(process.env.MONGO_URI)
if (await Admin.findOne({ email: email.toLowerCase() })) {
  console.log('Admin already exists')
} else {
  await Admin.create({ email, name, role: 'owner', password: await bcrypt.hash(password, 12) })
  console.log('Admin created:', email)
}
await mongoose.disconnect()