import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Loader2, Send, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { initPixel } from '../../lib/pixel'

const SCRIPT = 'https://connect.facebook.net/en_US/fbevents.js'

// every event the store sends, and where
const EVENTS = [
  ['PageView', 'Every page of the store', 'Each time a visitor opens a page.'],
  ['ViewContent', 'Product page', 'When a product page opens (product id, name, price).'],
  ['AddToCart', 'Product page', 'When “Add to cart” is tapped (value of what was added).'],
  ['InitiateCheckout', 'Product page and checkout', 'When the order form pop-up opens, or the checkout page opens with items.'],
  ['Purchase', 'Order form', 'When an order is placed successfully (order total, products, number of items).'],
]

function Row({ state, title, detail }) {
  const icon = {
    ok: <CheckCircle2 size={18} className="text-ink" aria-hidden="true" />,
    fail: <XCircle size={18} className="text-red-600" aria-hidden="true" />,
    wait: <Loader2 size={18} className="animate-spin text-gray-500" aria-hidden="true" />,
    idle: <Circle size={18} className="text-gray-300" aria-hidden="true" />,
  }[state]
  const word = { ok: 'OK', fail: 'Problem', wait: 'Checking…', idle: 'Not checked' }[state]
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className="font-medium">{title} <span className="sr-only">: {word}</span></div>
        {detail && <div className="text-xs text-gray-600">{detail}</div>}
      </div>
      <span className={`text-xs font-semibold ${state === 'ok' ? 'text-ink' : state === 'fail' ? 'text-red-600' : 'text-gray-500'}`}>{word}</span>
    </li>
  )
}

export default function Pixel() {
  const [pixelId, setPixelId] = useState(null)
  const [checks, setChecks] = useState({ script: 'idle', loaded: 'idle' })
  const [detail, setDetail] = useState({})
  const [test, setTest] = useState('')

  useEffect(() => {
    api('/settings/admin').then((s) => setPixelId(s.pixelId || '')).catch(() => setPixelId(''))
  }, [])

  const formatOk = /^\d{15,16}$/.test(pixelId || '')

  async function runCheck() {
    setTest('')
    setChecks({ script: 'wait', loaded: 'wait' })
    setDetail({})

    // 1) can this browser reach Meta's pixel script? (ad blockers often stop it)
    let reachable = false
    try {
      await fetch(SCRIPT, { mode: 'no-cors', cache: 'no-store' })
      reachable = true
    } catch {
      reachable = false
    }
    setChecks((c) => ({ ...c, script: reachable ? 'ok' : 'fail' }))
    setDetail((d) => ({
      ...d,
      script: reachable ? 'connect.facebook.net answered.' : 'Blocked: switch off the ad blocker / private DNS for this site, then check again. Customers with blockers are not tracked either.',
    }))

    // 2) does the pixel load with your ID? (init only: no PageView is sent from the admin)
    if (!formatOk || !reachable) {
      setChecks((c) => ({ ...c, loaded: 'fail' }))
      setDetail((d) => ({ ...d, loaded: !formatOk ? 'Fix the Pixel ID first.' : 'The script could not load.' }))
      return
    }
    initPixel(pixelId)
    const started = Date.now()
    const timer = setInterval(() => {
      const state = typeof window.fbq?.getState === 'function' ? window.fbq.getState() : null
      const ids = state?.pixels?.map((p) => String(p.id)) || []
      if (ids.includes(String(pixelId))) {
        clearInterval(timer)
        setChecks((c) => ({ ...c, loaded: 'ok' }))
        setDetail((d) => ({ ...d, loaded: `Pixel ${pixelId} is loaded in this browser.` }))
      } else if (Date.now() - started > 8000) {
        clearInterval(timer)
        setChecks((c) => ({ ...c, loaded: 'fail' }))
        setDetail((d) => ({ ...d, loaded: 'The pixel did not start within 8 seconds. Check the ID and any blocker.' }))
      }
    }, 300)
  }

  function sendTest() {
    if (!window.fbq) return setTest('Run the check first.')
    window.fbq('trackCustom', 'NextovaTest', { source: 'admin_test' })
    setTest(`Test event “NextovaTest” sent at ${new Date().toLocaleTimeString('en-GB')}. In Meta Events Manager open your pixel → Test events (or the Meta Pixel Helper extension) to see it arrive. It can take a minute.`)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meta Pixel</h1>
        <p className="text-sm text-gray-500">Check that Facebook / Instagram ads tracking works, and see what the store sends.</p>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Connection status</h2>
          <div className="flex gap-2">
            <button type="button" onClick={runCheck} disabled={pixelId === null}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
              Run check
            </button>
            <button type="button" onClick={sendTest} disabled={checks.loaded !== 'ok'}
              className="flex items-center gap-2 rounded-lg border border-ink bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-gray-100 disabled:opacity-50">
              <Send size={16} aria-hidden="true" /> Send test event
            </button>
          </div>
        </div>
        <ul className="divide-y text-sm">
          <Row
            state={pixelId === null ? 'wait' : formatOk ? 'ok' : 'fail'}
            title="Pixel ID saved"
            detail={pixelId ? `ID ${pixelId}${formatOk ? '' : ' does not look like a pixel ID (15 or 16 digits).'}` : <>No Pixel ID yet. Add it in <Link to="/admin/settings" className="font-semibold underline">Settings › Tracking</Link>.</>}
          />
          <Row state={checks.script} title="Meta's script reachable from this browser" detail={detail.script} />
          <Row state={checks.loaded} title="Pixel loads with your ID" detail={detail.loaded} />
        </ul>
        {test && <p className="mt-3 rounded-lg bg-gray-100 p-3 text-sm text-ink" role="status">{test}</p>}
        <p className="mt-3 text-xs text-gray-500">
          The check only starts the pixel; it does not send a page view. “Send test event” sends one custom event called
          NextovaTest so you can see it in Events Manager; it is not a purchase and does not affect your ads.
        </p>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Events the store sends</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="py-2 text-start">Event</th>
                <th className="text-start">Where</th>
                <th className="text-start">When</th>
              </tr>
            </thead>
            <tbody>
              {EVENTS.map(([name, where, when]) => (
                <tr key={name} className="border-b last:border-0 align-top">
                  <td className="py-2 font-mono text-xs font-semibold">{name}</td>
                  <td className="py-2 pe-3">{where}</td>
                  <td className="py-2 text-gray-600">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Your own visits while logged in to the admin are not tracked as page views. Orders also save the ad IDs and the
          _fbp / _fbc cookies, so you can match orders to ads on the Orders page.
        </p>
      </section>
    </div>
  )
}
