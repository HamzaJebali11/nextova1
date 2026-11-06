import { Router } from 'express'
import crypto from 'crypto'
import Order from '../orders/order.model.js'

const router = Router()

const OPEN = ['new', 'confirmed', 'processing', 'out_for_delivery']
const RANK = { sent: 1, delivered: 2, read: 3 }

// Meta calls this once to check the address
router.get('/webhook', (req, res) => {
  const token = req.query['hub.verify_token']
  if (req.query['hub.mode'] === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge'])
  }
  res.sendStatus(403)
})

// every event from Meta is signed: refuse anything that is not
function validSignature(req) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return false
  const given = Buffer.from(req.get('x-hub-signature-256') || '')
  const expected = Buffer.from(
    'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.alloc(0)).digest('hex')
  )
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}

async function onStatus(s) {
  const order = await Order.findOne({ 'whatsapp.messageId': s.id }).select('whatsapp')
  if (!order) return
  const current = order.whatsapp?.status

  if (s.status === 'failed') {
    if (current === 'delivered' || current === 'read') return // it did reach him
    const e = s.errors?.[0]
    await Order.updateOne({ _id: order._id }, {
      'whatsapp.status': 'failed',
      'whatsapp.error': e ? `${e.code}: ${e.title || e.message || ''}`.slice(0, 200) : 'failed',
    })
    return
  }

  if ((RANK[s.status] || 0) > (RANK[current] || 0)) {
    await Order.updateOne({ _id: order._id }, { 'whatsapp.status': s.status })
  }
}

async function onMessage(m) {
  let location
  if (m.type === 'location' && m.location) {
    const { latitude, longitude, name, address } = m.location
    location = {
      lat: latitude,
      lng: longitude,
      name: [name, address].filter(Boolean).join(' · '),
      url: `https://www.google.com/maps?q=${latitude},${longitude}`,
    }
  } else if (m.type === 'text') {
    const match = (m.text?.body || '').match(
      /https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*/i
    )
    if (match) location = { url: match[0] }
  }
  if (!location) return

  location.receivedAt = new Date()
  // attach to the customer's newest open order
  await Order.findOneAndUpdate(
    { 'customer.phone': `+${m.from}`, status: { $in: OPEN } },
    { location },
    { sort: { createdAt: -1 } }
  )
}

router.post('/webhook', async (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401)
  res.sendStatus(200) // answer fast, then process
  try {
    for (const entry of req.body?.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {}
        for (const s of value.statuses || []) await onStatus(s)
        for (const m of value.messages || []) await onMessage(m)
      }
    }
  } catch (e) {
    console.error('WhatsApp webhook error:', e.message)
  }
})

export default router