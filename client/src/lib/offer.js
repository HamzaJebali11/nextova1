const KEY = 'nx_offer'
const DAY = 24 * 60 * 60 * 1000

export function claimOffer() {
  localStorage.setItem(KEY, JSON.stringify({ at: Date.now() }))
}

export function hasOffer() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY))
    return !!o && Date.now() - o.at < DAY
  } catch {
    return false
  }
}

export function clearOffer() {
  localStorage.removeItem(KEY)
}