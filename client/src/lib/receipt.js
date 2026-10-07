const T = {
  en: {
    hello: (n) => `Hello ${n},`,
    thanks: (store, num) => `Thank you for shopping with ${store}! Your order ${num} has been delivered. ✅`,
    receipt: 'Receipt', date: 'Date', subtotal: 'Subtotal', delivery: 'Delivery', free: 'Free',
    total: 'Total paid (cash on delivery)',
    review: 'We would love your feedback. Please leave a quick review (photos welcome):',
    help: 'Need anything? Just reply to this message.',
    money: (n) => `QAR ${n}`,
  },
  ar: {
    hello: (n) => `مرحبًا ${n}،`,
    thanks: (store, num) => `شكرًا لتسوقك من ${store}! تم توصيل طلبك رقم ${num}. ✅`,
    receipt: 'الإيصال', date: 'التاريخ', subtotal: 'المجموع الفرعي', delivery: 'التوصيل', free: 'مجاني',
    total: 'الإجمالي المدفوع (الدفع عند الاستلام)',
    review: 'يسعدنا سماع رأيك. اترك تقييمًا سريعًا (الصور مرحّب بها):',
    help: 'هل تحتاج أي مساعدة؟ ردّ على هذه الرسالة.',
    money: (n) => `${n} ر.ق`,
  },
}

export function buildReceipt(order, { lang = 'en', storeName = 'Nextova', siteUrl = '' } = {}) {
  const t = T[lang]
  const date = new Date(order.deliveredAt || Date.now()).toLocaleDateString(
    lang === 'ar' ? 'ar-QA-u-nu-latn' : 'en-GB', { dateStyle: 'medium' })

  const lines = order.items.map(
    (i) => `• ${i.qty} × ${i.name}${i.variantName ? ` (${i.variantName})` : ''} — ${t.money(i.price * i.qty)}`)

  const links = []
  const seen = new Set()
  for (const i of order.items) {
    const slug = i.product?.slug
    if (slug && !seen.has(slug) && links.length < 3) {
      seen.add(slug)
      links.push(`${siteUrl}/product/${slug}#reviews`)
    }
  }

  return [
    t.hello(order.customer.name), '',
    t.thanks(storeName, order.orderNumber), '',
    `🧾 ${t.receipt} · ${t.date}: ${date}`,
    ...lines, '',
    `${t.subtotal}: ${t.money(order.subtotal)}`,
    `${t.delivery}: ${order.deliveryFee ? t.money(order.deliveryFee) : t.free}`,
    `*${t.total}: ${t.money(order.total)}*`,
    ...(links.length ? ['', `⭐ ${t.review}`, ...links] : []),
    '', t.help,
  ].join('\n')
}