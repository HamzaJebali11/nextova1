import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

export default function Settings() {
  const [s, setS] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api('/settings').then(setS) }, [])

  if (!s) return <div className="text-gray-500">Loading…</div>

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }))
  const setNested = (k, sub, v) => setS((x) => ({ ...x, [k]: { ...x[k], [sub]: v } }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          storeName: s.storeName,
          currency: s.currency,
          whatsappNumber: s.whatsappNumber || '',
          deliveryFee: Number(s.deliveryFee) || 0,
          freeDeliveryThreshold: Number(s.freeDeliveryThreshold) || 0,
          announcementBar: s.announcementBar,
          social: s.social,
          pixelId: s.pixelId || '',
        },
      })
      setMsg('Saved ✓')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Store settings</h1>

      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">General</h2>
        <Field label="Store name">
          <input className={inputCls} value={s.storeName || ''} onChange={(e) => set('storeName', e.target.value)} />
        </Field>
        <Field label="WhatsApp number" hint="With country code, digits only. Example: 97455123456">
          <input className={inputCls} value={s.whatsappNumber || ''} onChange={(e) => set('whatsappNumber', e.target.value.replace(/\D/g, ''))} />
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Delivery</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery fee (QAR)" hint="0 = free delivery">
            <input type="number" min="0" className={inputCls} value={s.deliveryFee ?? 0} onChange={(e) => set('deliveryFee', e.target.value)} />
          </Field>
          <Field label="Free delivery from (QAR)" hint="0 = no free-delivery threshold">
            <input type="number" min="0" className={inputCls} value={s.freeDeliveryThreshold ?? 0} onChange={(e) => set('freeDeliveryThreshold', e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Announcement bar</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!s.announcementBar?.enabled}
            onChange={(e) => setNested('announcementBar', 'enabled', e.target.checked)} />
          Show at the top of the store
        </label>
        <Field label="Text (English)">
          <input className={inputCls} value={s.announcementBar?.en || ''} onChange={(e) => setNested('announcementBar', 'en', e.target.value)} />
        </Field>
        <Field label="Text (Arabic)">
          <input dir="rtl" className={inputCls} value={s.announcementBar?.ar || ''} onChange={(e) => setNested('announcementBar', 'ar', e.target.value)} />
        </Field>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Social and ads</h2>
        <Field label="Facebook page link">
          <input className={inputCls} value={s.social?.facebook || ''} onChange={(e) => setNested('social', 'facebook', e.target.value)} />
        </Field>
        <Field label="Instagram link">
          <input className={inputCls} value={s.social?.instagram || ''} onChange={(e) => setNested('social', 'instagram', e.target.value)} />
        </Field>
        <Field label="TikTok link">
          <input className={inputCls} value={s.social?.tiktok || ''} onChange={(e) => setNested('social', 'tiktok', e.target.value)} />
        </Field>
        <Field label="Meta Pixel ID" hint="For tracking your Facebook ads (we'll use it in the storefront)">
          <input className={inputCls} value={s.pixelId || ''} onChange={(e) => set('pixelId', e.target.value.trim())} />
        </Field>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-lg bg-gray-900 px-5 py-2.5 font-medium text-white hover:bg-gray-700 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </form>
  )
}