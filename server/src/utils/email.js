// Generic e-mail through the existing Resend setup (RESEND_API_KEY, MAIL_FROM).
// Nothing is sent when the key is missing or MAIL_DRY_RUN=1 (tests): the e-mail is only written to the log.
export async function sendEmail({ to, subject, html, attachments }) {
  const recipients = (Array.isArray(to) ? to : String(to || '').split(',')).map((s) => s.trim()).filter(Boolean)
  if (recipients.length === 0) return { sent: false, reason: 'no address' }
  const key = process.env.RESEND_API_KEY
  if (!key || process.env.MAIL_DRY_RUN === '1') {
    console.log(`[email not sent: ${key ? 'MAIL_DRY_RUN' : 'no RESEND_API_KEY'}] to=${recipients.length} address(es) subject="${subject}"`)
    return { sent: false, reason: key ? 'dry run' : 'email not set up', logged: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    signal: AbortSignal.timeout(10000), // a provider that never answers must not hang the request (10 s)
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Nextova <onboarding@resend.dev>',
      to: recipients, subject, html,
      ...(attachments ? { attachments } : {}),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('Email failed:', res.status, text.slice(0, 300))
    return { sent: false, reason: `Resend error ${res.status}` }
  }
  return { sent: true }
}

export const esc = (v = '') =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
