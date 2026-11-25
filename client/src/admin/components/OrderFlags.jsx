import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Ban, Copy, RotateCcw, X } from 'lucide-react'
import { FAIL_REASONS, reasonLabel } from '../../lib/constants'
import { useDialogFocus } from '../../lib/useDialogFocus'

// amber / red chips for the checks made when the order was created (never shown to the customer)
export function FlagChips({ flags, held }) {
  if (!flags) return null
  const chips = []
  if (flags.blocked) chips.push(<span key="b" className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800"><Ban size={11} aria-hidden="true" /> Blocked</span>)
  if (flags.failedBefore > 0) chips.push(<span key="f" className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200"><RotateCcw size={11} aria-hidden="true" /> Failed before ×{flags.failedBefore}</span>)
  if (flags.duplicate) chips.push(<span key="d" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900" title={flags.duplicateOf ? `Same phone: ${flags.duplicateOf}` : ''}><Copy size={11} aria-hidden="true" /> Duplicate{flags.duplicateOf ? ` of ${flags.duplicateOf}` : ''}</span>)
  if (held) chips.push(<span key="h" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-300"><AlertTriangle size={11} aria-hidden="true" /> On hold</span>)
  return chips.length ? <span className="inline-flex flex-wrap gap-1">{chips}</span> : null
}

// the failed-delivery reason
export function FailureChip({ failure }) {
  if (!failure?.reason) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white" title={failure.note || ''}>
      Failed: {reasonLabel(failure.reason)}
    </span>
  )
}

// "Failed / returned" needs a reason; units go back to stock unless you untick the box.
// onConfirm({ reason, reasonNote, restock }) may return a promise; the dialog stays open while it runs.
export function FailedDialog({ count = 1, title, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [restock, setRestock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)
  useDialogFocus(ref, true)

  async function submit(e) {
    e.preventDefault()
    if (!reason) return setError('Choose why the delivery failed.')
    setBusy(true)
    setError('')
    try {
      await onConfirm({ reason, reasonNote: note.trim() || undefined, restock })
    } catch (err) {
      setError(err.message || 'Could not save.')
      setBusy(false)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={() => !busy && onCancel()} onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}>
      <motion.form ref={ref} role="dialog" aria-modal="true" aria-labelledby="failed-title" onSubmit={submit}
        onClick={(e) => e.stopPropagation()} initial={{ y: 12 }} animate={{ y: 0 }}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="failed-title" className="text-lg font-bold">{title || 'Delivery failed'}</h2>
            <p className="text-sm text-gray-500">{count > 1 ? `${count} orders get the same reason.` : 'Saved on the order with the date and your name.'}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Reason *</legend>
          <div className="grid gap-1.5">
            {FAIL_REASONS.map((r) => (
              <label key={r.value} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${reason === r.value ? 'border-ink bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}>
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-3 block text-sm font-semibold">Note <span className="font-normal text-gray-500">(optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2}
            className="mt-1 w-full rounded-lg border p-2 text-sm font-normal outline-none focus:ring-2 focus:ring-gray-900" />
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="mt-0.5" />
          <span><b>Return the units to stock</b><br /><span className="text-gray-500">Units that are already back in stock are never added twice.</span></span>
        </label>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="h-10 rounded-lg border px-4 text-sm hover:bg-gray-100">Cancel</button>
          <button disabled={busy} className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60">
            {busy ? 'Saving…' : count > 1 ? `Mark ${count} as failed` : 'Mark as failed'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
