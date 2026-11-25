// WhatsApp message asking the customer for their exact delivery location (order panel and delivery sheet)
export function locationMessage(order, lang, store) {
  const first = String(order.customer.name).split(/\s+/)[0]
  const list = order.items.filter((i) => i.price > 0).map((i) => `${i.qty} × ${i.name}`).join(', ')
  return lang === 'ar'
    ? `مرحبًا ${first}، معك ${store}. استلمنا طلبك رقم ${order.orderNumber} (${list}). من فضلك أرسل لنا موقعك الدقيق للتوصيل: اضغط 📎 ثم اختر "الموقع" ثم أرسل. شكرًا لك!`
    : `Hello ${first}, this is ${store}. We received your order ${order.orderNumber} (${list}). Please send us your exact delivery location: tap 📎, choose Location, then send. Thank you!`
}
