let ready = false
const pending = []

export function initPixel(id) {
  if (!id || ready || typeof window === 'undefined') return
  ready = true
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', id)
  pending.splice(0).forEach(([event, data]) => window.fbq('track', event, data))
}

export function pageView() {
  if (window.fbq) window.fbq('track', 'PageView')
}

export function track(event, data) {
  if (window.fbq) window.fbq('track', event, data)
  else if (pending.length < 20) pending.push([event, data])
}