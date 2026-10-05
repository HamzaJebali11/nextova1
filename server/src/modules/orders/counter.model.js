import mongoose from 'mongoose'

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 1000 },
})

export default mongoose.model('Counter', counterSchema)