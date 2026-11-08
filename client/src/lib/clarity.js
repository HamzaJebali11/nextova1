let started = false

function maskFields(root) {
  root.querySelectorAll?.('form, input, textarea, select').forEach((el) => el.setAttribute('data-clarity-mask', 'true'))
}

// Loads Microsoft Clarity (heatmaps + recordings). Everything typed into forms is hidden from recordings.
export function initClarity(id) {
  if (!id || started || !/^[a-z0-9]{6,20}$/i.test(id)) return
  started = true

  maskFields(document)
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return
        if (n.matches?.('form, input, textarea, select')) n.setAttribute('data-clarity-mask', 'true')
        maskFields(n)
      })
    }
  }).observe(document.body, { childList: true, subtree: true })

  ;(function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }
    t = l.createElement(r)
    t.async = 1
    t.src = 'https://www.clarity.ms/tag/' + i
    y = l.getElementsByTagName(r)[0]
    y.parentNode.insertBefore(t, y)
  })(window, document, 'clarity', 'script', id)
}