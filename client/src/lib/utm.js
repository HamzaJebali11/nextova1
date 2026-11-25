// AD ATTRIBUTION (first touch, kept 30 days in this browser)
//
// On the first page load that carries ad parameters we save them, and we keep that first touch
// for 30 days: a later visit (even from another ad) does not overwrite it. After 30 days the next
// ad landing starts a new first touch. The order sends what is saved here, plus the Meta _fbp/_fbc cookies.
//
// Meta does not add ad IDs to links by itself: set "URL parameters" on each ad in Ads Manager, e.g.
//   utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}
//   &utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
// fbclid is added by Meta automatically: it is a CLICK id, not an ad id.

const KEY = 'nx_attr'
const OLD_KEY = 'nx_utm' // older session-only storage
const TTL = 30 * 24 * 60 * 60 * 1000

// URL parameter -> saved field
const PARAMS = {
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_content: 'content',
  utm_term: 'term',
  ad_id: 'adId',
  adset_id: 'adsetId',
  campaign_id: 'campaignId',
  ttclid: 'ttclid',
  fbclid: 'fbclid',
}

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    if (v && typeof v === 'object' && Date.now() - (v.firstSeenAt || 0) < TTL) return v
  } catch {
    // storage blocked: attribution is optional
  }
  return null
}

function externalReferrer() {
  try {
    if (!document.referrer) return undefined
    const host = new URL(document.referrer).hostname
    return host && host !== window.location.hostname ? host.replace(/^www\./, '').slice(0, 100) : undefined
  } catch {
    return undefined
  }
}

export function captureUtm() {
  try {
    if (read()) return // first touch already saved and still fresh: keep it
    const p = new URLSearchParams(window.location.search)
    const found = {}
    for (const [param, field] of Object.entries(PARAMS)) {
      const v = p.get(param)
      if (v) found[field] = v.trim().slice(0, 200)
    }
    if (Object.keys(found).length === 0) {
      localStorage.removeItem(KEY) // expired and no new ad: forget it
      return
    }
    localStorage.setItem(KEY, JSON.stringify({
      ...found,
      landing: window.location.pathname.slice(0, 200),
      referrer: externalReferrer(),
      firstSeenAt: Date.now(),
    }))
    sessionStorage.removeItem(OLD_KEY)
  } catch {
    // never break the page because of tracking
  }
}

function cookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]).slice(0, 200) : undefined
}

// short form used by visits and unfinished-order leads (same shape as before)
export function getUtm() {
  const a = read()
  if (a && (a.source || a.medium || a.campaign)) {
    return { source: a.source?.slice(0, 60), medium: a.medium?.slice(0, 60), campaign: a.campaign?.slice(0, 100) }
  }
  try {
    return JSON.parse(sessionStorage.getItem(OLD_KEY)) || undefined
  } catch {
    return undefined
  }
}

// everything sent with an order
export function getAttribution() {
  const a = read() || {}
  const fbp = cookie('_fbp')
  // _fbc is set by the pixel from fbclid; if it is missing we build it the way Meta does: fb.1.<time>.<fbclid>
  const fbc = cookie('_fbc') || (a.fbclid ? `fb.1.${a.firstSeenAt || Date.now()}.${a.fbclid}` : undefined)
  let visitorId
  try { visitorId = localStorage.getItem('nx_vid') || undefined } catch { visitorId = undefined }
  const out = { ...a, fbp, fbc, visitorId }
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k])
  return Object.keys(out).length ? out : undefined
}
