import { esc } from './email.js'

const money = (n, cur = 'QAR') => `${cur} ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const pct = (v) => (v === null || v === undefined ? '–' : `${v > 0 ? '+' : ''}${v}%`)

// the weekly / monthly profit report as an e-mail (numbers only, never customer details)
export function reportEmailHtml(r, settings = {}) {
  const cur = settings.currency || 'QAR'
  const T = r.totals
  const P = r.previous?.totals || {}
  const C = r.change || {}
  const line = (label, key, isMoney = true) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${label}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right"><b>${isMoney ? money(T[key], cur) : T[key]}</b></td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:#666">${isMoney ? money(P[key], cur) : (P[key] ?? '–')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:#666">${pct(C[key])}</td>
    </tr>`
  const products = (r.products || []).slice(0, 10).map((p) => `
    <tr><td style="padding:4px 8px">${esc(p.name)}</td><td style="padding:4px 8px;text-align:right">${p.units}</td>
    <td style="padding:4px 8px;text-align:right">${money(p.profit, cur)}</td><td style="padding:4px 8px;text-align:right">${p.failedRate}%</td></tr>`).join('')
  const site = (process.env.CLIENT_URL || '').split(',')[0].trim()
  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111">
    <h2 style="margin:0 0 4px">${esc(settings.storeName || 'Nextova')} ${r.period.kind === 'month' ? 'monthly' : 'weekly'} report</h2>
    <p style="margin:0 0 16px;color:#555">${r.period.from} to ${r.period.to} (Qatar time) · compared with ${r.previous?.period?.from} to ${r.previous?.period?.to}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr style="color:#777;text-align:left"><th style="padding:6px 8px"></th><th style="padding:6px 8px;text-align:right">This period</th><th style="padding:6px 8px;text-align:right">Previous</th><th style="padding:6px 8px;text-align:right">Change</th></tr>
      ${line('Orders placed', 'placed', false)}${line('Delivered', 'delivered', false)}${line('Failed', 'failed', false)}
      ${line('Revenue (delivered)', 'revenue')}${line('Base cost of delivered units', 'baseCost')}${line('Delivery costs', 'deliveryCost')}
      ${line('Ad spend', 'adSpend')}${line('Net profit', 'net')}
    </table>
    <p style="font-size:12px;color:#777">Net profit = revenue of delivered orders - base cost of the delivered units - delivery costs - ad spend of the period.</p>
    ${products ? `<h3 style="margin:18px 0 6px">Products</h3><table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr style="color:#777;text-align:left"><th style="padding:4px 8px">Product</th><th style="padding:4px 8px;text-align:right">Units</th><th style="padding:4px 8px;text-align:right">Profit</th><th style="padding:4px 8px;text-align:right">Failed</th></tr>${products}</table>` : ''}
    ${site ? `<p style="margin-top:18px"><a href="${esc(site)}/admin/reports" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Reports</a></p>` : ''}
  </div>`
}
