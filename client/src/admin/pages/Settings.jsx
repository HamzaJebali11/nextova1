import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown, ArrowUp, BadgePercent, Bell, Building2, PackageCheck, Plus, Trash2, CheckCircle2, Megaphone, Radar, Share2, ShieldCheck, Store, Truck,
  AlertTriangle, FileBarChart, Mail,
} from 'lucide-react'
import { api } from '../../lib/api'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'

const inputCls = 'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

const TRUST = [
  ['delivery', 'Delivery', 'Delivery time and cost'],
  ['payment', 'Payment', 'Cash on delivery, can they check first?'],
  ['returns', 'Returns', 'Return or exchange rule'],
  ['support', 'Support', 'Confirmation call, WhatsApp support'],
]

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

function Card({ icon: Icon, title, hint, children, className = '' }) {
  return (
    <section className={`space-y-4 rounded-2xl border bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-ink" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

// what is sent to the server (same fields as before)
const payloadOf = (s) => ({
  storeName: s.storeName,
  legalName: s.legalName || '',
  crNumber: s.crNumber || '',
  logoUrl: s.logoUrl || '',
  currency: s.currency,
  whatsappNumber: s.whatsappNumber || '',
  deliveryFee: Number(s.deliveryFee) || 0,
  freeDeliveryThreshold: Number(s.freeDeliveryThreshold) || 0,
  shippingCostPerOrder: Number(s.shippingCostPerOrder) || 0,
  salesPopup: s.salesPopup !== false,
  exitOffer: {
    enabled: !!s.exitOffer?.enabled,
    percent: Math.min(50, Math.max(1, Number(s.exitOffer?.percent) || 10)),
  },
  announcementBar: s.announcementBar,
  announcements: (s.announcements || [])
    .map((a) => ({ en: (a.en || '').trim(), ar: (a.ar || '').trim(), active: a.active !== false }))
    .filter((a) => a.en || a.ar),
  announcementSeconds: Math.min(30, Math.max(2, Math.round(Number(s.announcementSeconds) || 4))),
  social: s.social,
  trust: s.trust || {},
  proofMinBought: Math.max(1, Math.round(Number(s.proofMinBought) || 5)),
  orderSound: !!s.orderSound,
  holdFlagged: !!s.holdFlagged,
  deliveryCostPerOrder: Math.max(0, Number(s.deliveryCostPerOrder) || 0),
  failedDeliveryCost: Math.max(0, Number(s.failedDeliveryCost) || 0),
  reportEmail: { to: (s.reportEmail?.to || '').trim(), weekly: !!s.reportEmail?.weekly, monthly: !!s.reportEmail?.monthly },
  alerts: {
    enabled: !!s.alerts?.enabled,
    email: (s.alerts?.email || '').trim(),
    noOrderHours: Math.min(720, Math.max(0, Math.round(Number(s.alerts?.noOrderHours) || 0))),
  },
  deliveryCountdown: s.deliveryCountdown !== false,
  deliveryCutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(s.deliveryCutoff || '') ? s.deliveryCutoff : '17:00',
  stockBarMax: Math.max(1, Math.round(Number(s.stockBarMax) || 15)),
  deliveryInfo: { en: s.deliveryInfo?.en || '', ar: s.deliveryInfo?.ar || '' },
  returnsInfo: { en: s.returnsInfo?.en || '', ar: s.returnsInfo?.ar || '' },
  pixelId: s.pixelId || '',
  clarityId: s.clarityId || '',
})

export default function Settings() {
  const [s, setS] = useState(null)
  const [savedJson, setSavedJson] = useState('')
  const [toast, setToast] = useState(null) // { ok, text }
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api('/settings/admin').then((raw) => {
      const d = { ...raw }
      if (!d.announcements?.length && (d.announcementBar?.en || d.announcementBar?.ar)) {
        d.announcements = [{ en: d.announcementBar.en || '', ar: d.announcementBar.ar || '', active: !!d.announcementBar.enabled }]
      }
      setS(d)
      setSavedJson(JSON.stringify(payloadOf(d)))
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  if (!s) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="grid gap-4 xl:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-48 rounded-2xl bg-gray-200" />)}</div>
      </div>
    )
  }

  const dirty = JSON.stringify(payloadOf(s)) !== savedJson
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }))
  const setNested = (k, sub, v) => setS((x) => ({ ...x, [k]: { ...x[k], [sub]: v } }))
  const setAnn = (i, patch) => setS((x) => ({ ...x, announcements: x.announcements.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))
  const moveAnn = (i, dir) => setS((x) => {
    const list = [...x.announcements]
    ;[list[i], list[i + dir]] = [list[i + dir], list[i]]
    return { ...x, announcements: list }
  })
  const setTrust = (key, lang, v) =>
    setS((x) => ({ ...x, trust: { ...x.trust, [key]: { ...x.trust?.[key], [lang]: v } } }))

  async function uploadLogo(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const img = await uploadImage(file)
      set('logoUrl', img.url)
    } catch (err) {
      setToast({ ok: false, text: err.message })
    } finally {
      setUploading(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const body = payloadOf(s)
      await api('/settings', { method: 'PUT', body })
      setSavedJson(JSON.stringify(body))
      setToast({ ok: true, text: 'Settings saved' })
    } catch (err) {
      setToast({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Store settings</h1>
        <p className="text-sm text-gray-500">One card per topic. Changes are saved together with the button at the bottom.</p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card icon={Store} title="Store and branding">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-2xl font-extrabold text-white ring-2 ring-gray-200">
              {s.logoUrl
                ? <img src={optimizeImg(s.logoUrl, 200)} alt="" className="h-full w-full object-cover" />
                : (s.storeName || 'N').charAt(0).toUpperCase()}
            </div>
            <div className="space-y-2 text-sm">
              <label className="inline-block cursor-pointer rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
                {uploading ? 'Uploading…' : 'Upload logo'}
                <input type="file" accept="image/*" hidden onChange={uploadLogo} disabled={uploading} />
              </label>
              {s.logoUrl && (
                <button type="button" onClick={() => set('logoUrl', '')} className="ms-2 text-red-600 hover:underline">Remove</button>
              )}
              <p className="text-xs text-gray-500">A square image works best. It shows in a circle next to the store name.</p>
            </div>
          </div>
          <Field label="Store name">
            <input className={inputCls} value={s.storeName || ''} onChange={(e) => set('storeName', e.target.value)} />
          </Field>
          <Field label="WhatsApp number" hint="With country code, digits only. Example: 97455123456">
            <input className={inputCls} value={s.whatsappNumber || ''} onChange={(e) => set('whatsappNumber', e.target.value.replace(/\D/g, ''))} />
          </Field>
        </Card>

        <Card icon={Building2} title="Business details" hint="Shown in the footer of the store.">
          <Field label="Registered business name" hint="Shown in the copyright line instead of the store name. Leave empty to use the store name.">
            <input className={inputCls} value={s.legalName || ''} onChange={(e) => set('legalName', e.target.value)} />
          </Field>
          <Field label="Commercial Registration (CR) number" hint="Shown as “CR No. …” in the footer. Leave empty to hide it.">
            <input className={inputCls} value={s.crNumber || ''} onChange={(e) => set('crNumber', e.target.value)} />
          </Field>
        </Card>

        <Card icon={Truck} title="Delivery and shipping">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery fee (QAR)" hint="0 = free delivery">
              <input type="number" min="0" className={inputCls} value={s.deliveryFee ?? 0} onChange={(e) => set('deliveryFee', e.target.value)} />
            </Field>
            <Field label="Free delivery from (QAR)" hint="0 = no free-delivery threshold">
              <input type="number" min="0" className={inputCls} value={s.freeDeliveryThreshold ?? 0} onChange={(e) => set('freeDeliveryThreshold', e.target.value)} />
            </Field>
          </div>
          <Field label="Shipping cost you pay per delivery (QAR)" hint="What the driver or courier costs you. Used in profit reports. You can adjust it on each order.">
            <input type="number" min="0" className={inputCls} value={s.shippingCostPerOrder ?? 0} onChange={(e) => set('shippingCostPerOrder', e.target.value)} />
          </Field>
        </Card>

        <Card icon={BadgePercent} title="“Before you leave” offer">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!s.exitOffer?.enabled} onChange={(e) => setNested('exitOffer', 'enabled', e.target.checked)} />
            Show a discount popup to visitors with something in their cart who are about to leave
          </label>
          <Field label="Discount (%)" hint="Once per phone number, valid 24 hours after they claim it. The discount comes out of your profit, so pick a number you can afford (maximum 50).">
            <input type="number" min="1" max="50" className={inputCls} value={s.exitOffer?.percent ?? 10}
              onChange={(e) => setNested('exitOffer', 'percent', e.target.value)} />
          </Field>
        </Card>

        <Card icon={Megaphone} title="Storefront">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.salesPopup !== false} onChange={(e) => set('salesPopup', e.target.checked)} />
            Show the "someone just ordered" popup (real recent orders: first name, area and product only)
          </label>
          <Field label="Show the social proof bar from (units bought)"
            hint="The bar under the product title (bought, viewed this week, liked) stays hidden until a product has at least this many units bought in real orders. Default 5.">
            <input type="number" min="1" className={inputCls} value={s.proofMinBought ?? 5} onChange={(e) => set('proofMinBought', e.target.value)} />
          </Field>
        </Card>

        <Card icon={Megaphone} title="Announcement bar (rotating)"
          hint="The black bar at the very top. One message at a time, changing every few seconds and looping. Only active messages show; one message stays still.">
          <ul className="space-y-2">
            {(s.announcements || []).map((a, i, list) => (
              <li key={i} className={`space-y-2 rounded-xl border p-3 ${a.active === false ? 'bg-gray-50 opacity-70' : ''}`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={inputCls} maxLength={140} placeholder="Message (English)" value={a.en || ''}
                    onChange={(e) => setAnn(i, { en: e.target.value })} />
                  <input dir="rtl" className={inputCls} maxLength={140} placeholder="الرسالة (Arabic)" value={a.ar || ''}
                    onChange={(e) => setAnn(i, { ar: e.target.value })} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={a.active !== false} onChange={(e) => setAnn(i, { active: e.target.checked })} /> Active
                  </label>
                  <span className="ms-auto flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => moveAnn(i, -1)} aria-label="Move up"
                      className="rounded-lg border bg-white p-1.5 hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                    <button type="button" disabled={i === list.length - 1} onClick={() => moveAnn(i, 1)} aria-label="Move down"
                      className="rounded-lg border bg-white p-1.5 hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={15} /></button>
                    <button type="button" onClick={() => set('announcements', list.filter((_, j) => j !== i))} aria-label="Delete message"
                      className="rounded-lg border bg-white p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" onClick={() => set('announcements', [...(s.announcements || []), { en: '', ar: '', active: true }])}
              className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-100">
              <Plus size={15} /> Add message
            </button>
            <label className="block w-40">
              <span className="mb-1 block text-xs font-medium">Seconds per message</span>
              <input type="number" min="2" max="30" className={inputCls} value={s.announcementSeconds ?? 4}
                onChange={(e) => set('announcementSeconds', e.target.value)} />
            </label>
          </div>
        </Card>

        <Card icon={Share2} title="Social links">
          <Field label="Facebook page link">
            <input className={inputCls} value={s.social?.facebook || ''} onChange={(e) => setNested('social', 'facebook', e.target.value)} />
          </Field>
          <Field label="Instagram link">
            <input className={inputCls} value={s.social?.instagram || ''} onChange={(e) => setNested('social', 'instagram', e.target.value)} />
          </Field>
          <Field label="TikTok link">
            <input className={inputCls} value={s.social?.tiktok || ''} onChange={(e) => setNested('social', 'tiktok', e.target.value)} />
          </Field>
        </Card>

        <Card icon={PackageCheck} title="Product page"
          hint="Delivery estimate, low-stock bar and the Delivery / Returns accordions (a product can override the texts).">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.deliveryCountdown !== false} onChange={(e) => set('deliveryCountdown', e.target.checked)} />
            Show the countdown “Order within 3h 12m and get it within 2 working days”
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Daily cut-off time (Qatar time)" hint="Before it: real countdown. After it: “Order now and get it within 2 working days”.">
              <input type="time" className={inputCls} value={s.deliveryCutoff || '17:00'} onChange={(e) => set('deliveryCutoff', e.target.value)} />
            </Field>
            <Field label="Show “Only N left in stock” at or below" hint="Uses the real stock. Default 15.">
              <input type="number" min="1" className={inputCls} value={s.stockBarMax ?? 15} onChange={(e) => set('stockBarMax', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery information (English)">
              <textarea rows={3} className={inputCls} value={s.deliveryInfo?.en || ''} onChange={(e) => setNested('deliveryInfo', 'en', e.target.value)} />
            </Field>
            <Field label="Delivery information (Arabic)">
              <textarea dir="rtl" rows={3} className={inputCls} value={s.deliveryInfo?.ar || ''} onChange={(e) => setNested('deliveryInfo', 'ar', e.target.value)} />
            </Field>
            <Field label="Returns (English)">
              <textarea rows={3} className={inputCls} value={s.returnsInfo?.en || ''} onChange={(e) => setNested('returnsInfo', 'en', e.target.value)} />
            </Field>
            <Field label="Returns (Arabic)">
              <textarea dir="rtl" rows={3} className={inputCls} value={s.returnsInfo?.ar || ''} onChange={(e) => setNested('returnsInfo', 'ar', e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-gray-500">An empty text hides that accordion. Write only what is true for your business.</p>
        </Card>

        <Card icon={Bell} title="Admin notifications" hint="A notification shows at the top of the admin when a new website order arrives (checked every 15 seconds).">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!s.orderSound} onChange={(e) => set('orderSound', e.target.checked)} />
            Order notification sound (a soft chime)
          </label>
          <p className="text-xs text-gray-500">Browsers only play sound after you have clicked somewhere in the admin once.</p>
        </Card>

        <Card icon={ShieldCheck} title="Flagged orders" hint="New orders are checked for: failed before (this phone has failed deliveries), duplicate (same phone in the last 24 hours) and blocked phone. The customer never sees a difference.">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={!!s.holdFlagged} onChange={(e) => set('holdFlagged', e.target.checked)} className="mt-0.5" />
            <span>Put flagged orders on hold as <b>“Needs confirmation”</b><br /><span className="text-xs text-gray-500">They stay off the Delivery sheet until you confirm them. Off: they arrive as New with a flag.</span></span>
          </label>
          <p className="text-xs text-gray-500">Block or unblock a phone from the order panel or the <Link to="/admin/customers" className="font-semibold underline">Customers</Link> page.</p>
        </Card>

        <Card icon={FileBarChart} title="Reports" hint="Used by the weekly and monthly profit report (cash view). Both are applied per order: delivered orders and failed deliveries.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Delivery cost per delivered order (QAR)">
              <input type="number" min="0" step="0.5" className={inputCls} value={s.deliveryCostPerOrder ?? 0} onChange={(e) => set('deliveryCostPerOrder', e.target.value)} />
            </Field>
            <Field label="Cost of a failed delivery (QAR)">
              <input type="number" min="0" step="0.5" className={inputCls} value={s.failedDeliveryCost ?? 0} onChange={(e) => set('failedDeliveryCost', e.target.value)} />
            </Field>
          </div>
          <Field label="Send the report to (e-mail)" hint="Sent with your Resend set-up (RESEND_API_KEY on the server). Numbers only, no customer details.">
            <input type="email" className={inputCls} value={s.reportEmail?.to || ''} onChange={(e) => setNested('reportEmail', 'to', e.target.value)} placeholder="you@example.com" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!s.reportEmail?.weekly} onChange={(e) => setNested('reportEmail', 'weekly', e.target.checked)} />
            Weekly report every Sunday at 08:00 (Qatar time) for the week Saturday to Friday
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!s.reportEmail?.monthly} onChange={(e) => setNested('reportEmail', 'monthly', e.target.checked)} />
            Monthly report on day 1 at 08:00 (Qatar time) for the month before
          </label>
        </Card>

        <Card icon={AlertTriangle} title="Alerts by e-mail" hint="At most one e-mail per kind per hour. Never includes customer details. Errors are listed on the System status page.">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!s.alerts?.enabled} onChange={(e) => setNested('alerts', 'enabled', e.target.checked)} />
            Send alerts: a new kind of error, or more than 10 errors within 10 minutes
          </label>
          <Field label="Alert e-mail">
            <input type="email" className={inputCls} value={s.alerts?.email || ''} onChange={(e) => setNested('alerts', 'email', e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Also alert when no website order for (hours)" hint="0 = off. Example: 12.">
            <input type="number" min="0" max="720" className={inputCls} value={s.alerts?.noOrderHours ?? 0} onChange={(e) => setNested('alerts', 'noOrderHours', e.target.value)} />
          </Field>
          <p className="flex items-center gap-1 text-xs text-gray-500"><Mail size={13} aria-hidden="true" /> See <Link to="/admin/system" className="font-semibold underline">System status</Link> for the error list and the health check address.</p>
        </Card>

        <Card icon={Radar} title="Tracking" hint="Meta Pixel and Microsoft Clarity.">
          <Field label="Meta Pixel ID" hint={<>For tracking your Facebook ads. Check it on the <Link to="/admin/pixel" className="font-semibold underline">Pixel page</Link>.</>}>
            <input className={inputCls} value={s.pixelId || ''} onChange={(e) => set('pixelId', e.target.value.trim())} />
          </Field>
          <Field label="Microsoft Clarity project ID" hint="Free heatmaps and recordings (clarity.microsoft.com). Leave empty to switch it off. Your own visits and everything typed in forms are never recorded.">
            <input className={inputCls} value={s.clarityId || ''} onChange={(e) => set('clarityId', e.target.value.trim())} />
          </Field>
        </Card>

        <Card icon={ShieldCheck} title="Trust information (old)"
          hint="The product page now shows a fixed trust row (delivery within 2 working days, cash on delivery, WhatsApp support), so these lines are not shown in the store at the moment. They are kept and saved.">
          {TRUST.map(([key, label, hint]) => (
            <div key={key} className="grid gap-2 sm:grid-cols-2">
              <Field label={`${label} (English)`} hint={hint}>
                <input maxLength={120} className={inputCls} value={s.trust?.[key]?.en || ''} onChange={(e) => setTrust(key, 'en', e.target.value)} />
              </Field>
              <Field label={`${label} (Arabic)`}>
                <input dir="rtl" maxLength={120} className={inputCls} value={s.trust?.[key]?.ar || ''} onChange={(e) => setTrust(key, 'ar', e.target.value)} />
              </Field>
            </div>
          ))}
        </Card>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-3 backdrop-blur md:start-60">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <span className={`text-sm ${dirty ? 'font-semibold text-ink underline decoration-2' : 'text-gray-500'}`}>
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </span>
          <button disabled={busy || uploading || !dirty}
            className="rounded-lg px-5 py-2.5 bg-accent font-bold text-white hover:bg-accent-hover disabled:opacity-50">
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className={`fixed bottom-20 end-4 z-40 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.ok ? 'bg-ink text-white' : 'bg-red-600 text-white'
            }`}>
            {toast.ok && <CheckCircle2 size={18} aria-hidden="true" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}
