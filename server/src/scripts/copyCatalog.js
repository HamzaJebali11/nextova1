import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

const from = process.env.MONGO_URI   // your current (test) database
const to = process.env.TARGET_URI    // the new live database
if (!from || !to) {
  console.log('Set TARGET_URI to the live database address first.')
  process.exit(1)
}

const COLLECTIONS = ['categories', 'products', 'pages', 'settings']

const src = await mongoose.createConnection(from).asPromise()
const dst = await mongoose.createConnection(to).asPromise()

for (const name of COLLECTIONS) {
  let docs = await src.collection(name).find({}).toArray()
  if (!docs.length) {
    console.log(`${name}: nothing to copy`)
    continue
  }
  if (name === 'products') {
    docs = docs.map((d) => ({ ...d, soldCount: 0, ratingAvg: 0, ratingCount: 0 }))
  }
  await dst.collection(name).deleteMany({})
  await dst.collection(name).insertMany(docs)
  console.log(`${name}: ${docs.length} copied`)
}

await src.close()
await dst.close()
console.log('Done.')