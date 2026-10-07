const API_URL = 'https://api.resend.com/emails'

const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export async function sendOrderEmail(order, settings = {}) {
  const key = process.env.RESEND_API_KEY
  const recipients = (process.env.NOTIFY_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!key || recipients.length === 0) return // email not set up yet: skip quietly

  const cur = settings.currency || 'QAR'
  const c = order.customer
  const site = (process.env.CLIENT_URL || '').split(',')[0].trim()
  const phoneDigits = String(c.phone).replace(/\D/g, '')
  const ad = [order.utm?.source, order.utm?.medium, order.utm?.campaign].filter(Boolean).join(' / ')

  const rows = order.items.map((i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(i.name)}${i.variantName ? ` <span style="color:#777">(${esc(i.variantName)})</span>` : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${cur} ${i.price * i.qty}</td>
    </tr>`).join('')

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111">
    <h2 style="margin:0 0 4px">New order ${esc(order.orderNumber)}</h2>
    <p style="margin:0 0 16px;color:#555">Total to collect (cash on delivery): <b>${cur} ${order.total}</b></p>

    <div style="background:#f6f6f6;border-radius:10px;padding:14px;margin-bottom:16px">
      <b>${esc(c.name)}</b><br/>
      <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> ·
      <a href="https://wa.me/${phoneDigits}">WhatsApp</a><br/>
      ${esc([c.area, c.address].filter(Boolean).join(' · '))}
      ${c.notes ? `<br/><i>Note: ${esc(c.notes)}</i>` : ''}
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="text-align:left;color:#777"><th style="padding:8px">Item</th><th style="padding:8px;text-align:center">Qty</th><th style="padding:8px;text-align:right">Price</th></tr>
      ${rows}
      <tr><td colspan="2" style="padding:8px;text-align:right">Delivery</td><td style="padding:8px;text-align:right">${order.deliveryFee ? `${cur} ${order.deliveryFee}` : 'Free'}</td></tr>
      <tr><td colspan="2" style="padding:8px;text-align:right"><b>Total</b></td><td style="padding:8px;text-align:right"><b>${cur} ${order.total}</b></td></tr>
    </table>

    ${ad ? `<p style="color:#777;font-size:13px">Came from ad: ${esc(ad)}</p>` : ''}
    ${site ? `<p><a href="${esc(site)}/admin/orders" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open in admin</a></p>` : ''}
  </div>`

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Nextova Orders <onboarding@resend.dev>',
      to: recipients,
      subject: `New order ${order.orderNumber} · ${cur} ${order.total}`,
      html,
    }),
  })
  if (!res.ok) console.error('Order email failed:', res.status, await res.text())
}