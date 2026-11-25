// open the printable packing slips / labels for some orders in a new tab (admin)
// type: 'slips' (A4, 2 per page) | 'labels' (100 x 150 mm, 1 per page) | 'labels-a4' (A4, 4 per page)
export function openPrint(ids, type = 'slips') {
  const list = [...ids].slice(0, 200)
  if (list.length === 0) return
  window.open(`/admin/print?type=${type}&ids=${list.join(',')}`, '_blank', 'noopener')
}
