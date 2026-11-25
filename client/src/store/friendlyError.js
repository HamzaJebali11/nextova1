// A clear error message in the customer's language. The server answers in English: those details are shown
// in English mode; Arabic visitors get a translated message for the same situation.
export function friendlyError(err, t, lang) {
  if (err?.network) return t('errNetwork')
  if (err?.status === 429) return t('errTooMany')
  if (err?.status >= 500) return t('errServerTry')
  if (lang === 'en') return err?.details?.map((d) => d.message).join(' · ') || err?.message || t('errOrderFailed')
  if (err?.status === 409) return t('errOutOfStock')
  return t('errOrderFailed')
}
