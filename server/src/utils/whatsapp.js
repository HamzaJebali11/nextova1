// Sends the "order received, please send your location" template through Meta's WhatsApp Cloud API.
// It does nothing until the WHATSAPP_* variables are set in server/.env.

const clean = (s, max) =>
  String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max)

export async function sendOrderWhatsApp(order) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const template = process.env.WHATSAPP_TEMPLATE_NAME
  if (!token || !phoneId || !template) return // not set up yet: skip quietly

  const version = process.env.WHATSAPP_API_VERSION || 'v23.0'
  const language = process.env.WHATSAPP_TEMPLATE_LANG || 'en'

  const to = String(order.customer.phone).replace(/\D/g, '')
  const firstName = clean(String(order.customer.name).split(/\s+/)[0], 30) || 'there'
  const products =
    clean(order.items.filter((i) => i.price > 0).map((i) => i.name).slice(0, 3).join(', '), 80) || 'your order'

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: [firstName, order.orderNumber, products].map((text) => ({ type: 'text', text })),
          },
        ],
      },
    }),
  })
  if (!res.ok) console.error('WhatsApp message failed:', res.status, await res.text())
}