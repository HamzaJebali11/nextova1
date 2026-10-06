export function deliveryFor(subtotal, settings) {
  const free = Number(settings?.freeDeliveryThreshold) || 0
  const fee = Number(settings?.deliveryFee) || 0
  return free > 0 && subtotal >= free ? 0 : fee
}