import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { getUtm } from '../../lib/utm'
import { track } from '../../lib/pixel'
import { deliveryFor } from '../../lib/delivery'
import { hasOffer, clearOffer } from '../../lib/offer'
import { AREAS } from '../areas'
import { useStore } from '../storeContext'

const phoneOk = (v) => /^[3567]\d{7}$/.test(v)
const codeOk = (v) => /^[0-9A-Za-z/-]{1,10}$/.test(v.trim())

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

const inputCls = (err) =>
  `w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${
    err ? 'border-red-400 focus:ring-red-200' : 'focus:border-emerald-500 focus:ring-emerald-200'
  }`

// lines: [{ productId, variantName, qty, price }]
export default function OrderForm({ lines, onPlaced }) {
  const { t, lang, money, settings } = useStore()
  const navigate = useNavigate()
  const [f, setF] = useState({
    name: '', phone: '', area: '', zone: '', street: '', building: '', address: '', notes: '', website: '',
  })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  const submitted = useRef(false)
  const lastLead = useRef('')
  const linesRef = useRef(lines)
  useEffect(() => { linesRef.current = lines })

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const percent = settings.exitOffer?.enabled && hasOffer() ? Number(settings.exitOffer.percent) || 0 : 0
  const discount = percent ? Math.round(subtotal * percent) / 100 : 0
  const delivery = deliveryFor(subtotal - discount, settings)
  const total = subtotal - discount + delivery
  const linesKey = lines.map((l) => `${l.productId}|${l.variantName || ''}|${l.qty}`).join(',')

  // remember an unfinished order once a valid phone number has been typed
  useEffect(() => {
    if (!phoneOk(f.phone)) return
    const timer = setTimeout(() => {
      if (submitted.current) return
      const current = linesRef.current
      if (current.length === 0) return
      const body = {
        phone: f.phone,
        name: f.name.trim() || undefined,
        area: AREAS.find((a) => a.id === f.area)?.en,
        items: current.map((l) => ({ productId: l.productId, variantName: l.variantName || undefined, qty: l.qty })),
        total: Math.round(current.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100,
        utm: getUtm(),
        website: f.website,
      }
      const signature = JSON.stringify(body)
      if (signature === lastLead.current) return
      lastLead.current = signature
      sessionStorage.setItem('nx_lead', '1')
      api('/leads', { method: 'POST', body }).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [f.phone, f.name, f.area, f.website, linesKey])

  function validate() {
    const e = {}
    if (f.name.trim().length < 2) e.name = t('errName')
    if (!phoneOk(f.phone.trim())) e.phone = t('errPhone')
    if (!f.area) e.area = t('errArea')
    if (!codeOk(f.zone)) e.zone = t('errZone')
    if (!codeOk(f.street)) e.street = t('errStreet')
    if (!codeOk(f.building)) e.building = t('errBuilding')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev) {
    ev.preventDefault()
    setServerError('')
    if (busy || lines.length === 0 || !validate()) return
    setBusy(true)
    submitted.current = true
    try {
      const area = AREAS.find((a) => a.id === f.area)
      const res = await api('/orders', {
        method: 'POST',
        body: {
          customer: {
            name: f.name.trim(),
            phone: f.phone.trim(),
            area: area?.en,
            zone: f.zone.trim(),
            street: f.street.trim(),
            building: f.building.trim(),
            address: f.address.trim() || undefined,
            notes: f.notes.trim() || undefined,
          },
          items: lines.map((l) => ({ productId: l.productId, variantName: l.variantName || undefined, qty: l.qty })),
          offer: percent > 0 ? true : undefined,
          source: 'website',
          utm: getUtm(),
          website: f.website,
        },
      })
      track('Purchase', {
        value: res.total, currency: 'QAR', content_type: 'product',
        content_ids: lines.map((l) => l.productId),
        num_items: lines.reduce((n, l) => n + l.qty, 0),
      })
      if (percent > 0) clearOffer()
      onPlaced?.()
      navigate(`/order-success?n=${encodeURIComponent(res.orderNumber)}&t=${res.total}`)
    } catch (err) {
      submitted.current = false
      setServerError(err.details?.map((d) => d.message).join(' · ') || err.message)
    } finally {
      setBusy(false)
    }
  }

  const numberInput = (key, error) => (
    <input inputMode="numeric" maxLength={10} value={f[key]} dir="ltr"
      onChange={(e) => set(key, e.target.value.replace(/[^0-9A-Za-z/-]/g, ''))}
      className={inputCls(error)} />
  )

  return (
    <form onSubmit={submit} noValidate className="relative space-y-4">
      {/* hidden trap for spam bots: real people never see or fill this */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website}
        onChange={(e) => set('website', e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <Field label={t('fullName')} error={errors.name}>
        <input autoComplete="name" maxLength={80} value={f.name}
          onChange={(e) => set('name', e.target.value)} className={inputCls(errors.name)} />
      </Field>

      <Field label={t('phone')} error={errors.phone}>
        <div className="flex" dir="ltr">
          <span className="grid place-items-center rounded-s-xl border border-e-0 bg-gray-50 px-3 text-sm text-gray-600">+974</span>
          <input type="tel" inputMode="numeric" autoComplete="tel-national" value={f.phone}
            onChange={(e) => {
              let d = e.target.value.replace(/\D/g, '')
              if (d.startsWith('974') && d.length > 8) d = d.slice(3)
              set('phone', d.slice(0, 8))
            }}
            className={`${inputCls(errors.phone)} rounded-s-none`} placeholder="5512 3456" />
        </div>
      </Field>
      <p className="-mt-2 text-xs text-gray-500">{t('leadNote')}</p>

      <Field label={t('area')} error={errors.area}>
        <select value={f.area} onChange={(e) => set('area', e.target.value)} className={`${inputCls(errors.area)} bg-white`}>
          <option value="">{t('selectArea')}</option>
          {AREAS.map((a) => <option key={a.id} value={a.id}>{lang === 'ar' ? a.ar : a.en}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t('zone')} error={errors.zone}>{numberInput('zone', errors.zone)}</Field>
        <Field label={t('street')} error={errors.street}>{numberInput('street', errors.street)}</Field>
        <Field label={t('building')} error={errors.building}>{numberInput('building', errors.building)}</Field>
      </div>

      <Field label={t('landmark')}>
        <textarea rows={2} maxLength={300} value={f.address} placeholder={t('addressHint')}
          onChange={(e) => set('address', e.target.value)} className={inputCls(false)} />
      </Field>

      <Field label={t('notes')}>
        <textarea rows={2} maxLength={500} value={f.notes}
          onChange={(e) => set('notes', e.target.value)} className={inputCls(false)} />
      </Field>

      <div className="space-y-1 rounded-xl bg-gray-50 p-4 text-sm">
        <div className="flex justify-between"><span>{t('subtotal')}</span><span>{money(subtotal)}</span></div>
        {discount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>{t('discountLine').replace('{n}', percent)}</span><span>− {money(discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{t('delivery')}</span><span>{delivery === 0 ? t('free') : money(delivery)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>{t('total')}</span><span>{money(total)}</span>
        </div>
        <p className="pt-1 text-xs text-gray-500">{t('codNote')}</p>
      </div>

      {serverError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{serverError}</div>}

      <motion.button whileTap={{ scale: 0.98 }} disabled={busy || lines.length === 0}
        className="w-full rounded-full bg-emerald-600 py-3.5 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
        {busy ? t('placing') : `${t('placeOrder')} · ${money(total)}`}
      </motion.button>
    </form>
  )
}