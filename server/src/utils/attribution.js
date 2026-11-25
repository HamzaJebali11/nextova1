const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exact = (v) => new RegExp(`^${escapeRegex(v)}$`, 'i')

// Filter orders by ad campaign and/or ad. Values come from GET /orders/by-ad:
//   campaign: the campaign id, or the campaign name when there is no id
//   ad:       the ad id, or the ad name (utm_content) when there is no id
// Older orders (before ad ids were saved) still match on utm.campaign.
export function attributionFilter({ campaign, ad }) {
  const and = []
  if (campaign) {
    and.push({ $or: [
      { 'attribution.campaignId': String(campaign) },
      { 'attribution.campaign': exact(campaign) },
      { 'utm.campaign': exact(campaign) },
    ] })
  }
  if (ad) {
    and.push({ $or: [{ 'attribution.adId': String(ad) }, { 'attribution.content': exact(ad) }] })
  }
  return and
}

// one readable key per ad (used to group orders by ad)
export function adKeyOf(o) {
  const a = o.attribution || {}
  return {
    campaignId: a.campaignId || null,
    campaign: a.campaign || o.utm?.campaign || null,
    adsetId: a.adsetId || null,
    adset: a.term || null,
    adId: a.adId || null,
    ad: a.content || null,
    source: a.source || o.utm?.source || null,
  }
}
