export function addressParts(c = {}) {
  const parts = []
  if (c.zone) parts.push(`Zone ${c.zone}`)
  if (c.street) parts.push(`Street ${c.street}`)
  if (c.building) parts.push(`Building ${c.building}`)
  return parts
}

export function addressLine(c = {}) {
  return [c.area, ...addressParts(c), c.address].filter(Boolean).join(' · ')
}