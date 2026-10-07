import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { TEMPLATES } from '../pageTemplates'

const blank = { title: { en: '', ar: '' }, slug: '', content: { en: '', ar: '' }, isActive: false, showInFooter: true, sortOrder: 0 }
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

export default function Pages() {
  const [list, setList] = useState([])
  const [f, setF] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api('/pages/admin/all').then(setList)
  useEffect(() => { load().catch(() => {}) }, [])

  async function addStarters() {
    setBusy(true)
    try {
      const have = new Set(list.map((p) => p.slug))
      for (const tpl of TEMPLATES) {
        if (!have.has(tpl.slug)) {
          await api('/pages', { method: 'POST', body: { ...tpl, isActive: false, showInFooter: true } })
        }
      }
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function edit(p) {
    setEditId(p._id)
    setF({
      title: { en: p.title?.en || '', ar: p.title?.ar || '' },
      slug: p.slug,
      content: { en: p.content?.en || '', ar: p.content?.ar || '' },
      isActive: p.isActive,
      showInFooter: p.showInFooter,
      sortOrder: p.sortOrder || 0,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reset() {
    setEditId(null)
    setF(blank)
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const body = { ...f, sortOrder: Number(f.sortOrder) || 0 }
    try {
      if (editId) await api(`/pages/${editId}`, { method: 'PUT', body })
      else await api('/pages', { method: 'POST', body })
      reset()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function togglePublished(p) {
    try {
      await api(`/pages/${p._id}`, { method: 'PUT', body: { isActive: !p.isActive } })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  async function remove(p) {
    if (!confirm(`Delete "${p.title.en}"?`)) return
    try {
      await api(`/pages/${p._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pages</h1>
        <button onClick={addStarters} disabled={busy}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-60">
          {busy ? 'Adding…' : 'Add starter pages (Privacy, Terms, Returns, About, Contact)'}
        </button>
      </div>
      <p className="mb-5 text-sm text-gray-500">
        Starter pages are saved as <b>unpublished drafts</b> with <b>[PLACEHOLDERS]</b> you must replace with your real details. Publish a page only when it is finished.
        Format: <code>## Heading</code>, <code>- bullet</code>, and a blank line for a new paragraph. I'm not a lawyer, so check the wording matches your real practices.
      </p>

      <form onSubmit={submit} className="mb-6 space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold">{editId ? 'Edit page' : 'New page'}</h2>
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <input required placeholder="Title (English)" className={inputCls} value={f.title.en}
            onChange={(e) => setF({ ...f, title: { ...f.title, en: e.target.value } })} />
          <input dir="rtl" placeholder="العنوان (Arabic)" className={inputCls} value={f.title.ar}
            onChange={(e) => setF({ ...f, title: { ...f.title, ar: e.target.value } })} />
          <input placeholder="Link name, e.g. returns" className={inputCls} value={f.slug}
            onChange={(e) => setF({ ...f, slug: e.target.value })} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea rows={12} placeholder="Content (English)" className={inputCls} value={f.content.en}
            onChange={(e) => setF({ ...f, content: { ...f.content, en: e.target.value } })} />
          <textarea dir="rtl" rows={12} placeholder="المحتوى (Arabic, optional)" className={inputCls} value={f.content.ar}
            onChange={(e) => setF({ ...f, content: { ...f.content, ar: e.target.value } })} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Published</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.showInFooter} onChange={(e) => setF({ ...f, showInFooter: e.target.checked })} /> Show in footer</label>
            <label className="flex items-center gap-2">Order <input type="number" className="w-20 rounded-lg border px-2 py-1" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></label>
          </div>
          <div className="flex gap-2">
            {editId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 hover:bg-gray-100">Cancel</button>}
            <button className="rounded-lg bg-gray-900 px-5 py-2 text-white hover:bg-gray-700">{editId ? 'Save page' : 'Add page'}</button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {list.length === 0 && <div className="p-6 text-gray-500">No pages yet.</div>}
        <ul className="divide-y">
          {list.map((p) => (
            <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">{p.title.en} {p.title.ar && <span className="text-gray-400">· {p.title.ar}</span>}</div>
                <div className="text-xs text-gray-500">/page/{p.slug}{/\[[A-Z ]+/.test(p.content?.en || '') ? ' · still has [PLACEHOLDERS]' : ''}</div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button onClick={() => togglePublished(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                  {p.isActive ? 'Published' : 'Draft'}
                </button>
                <button onClick={() => edit(p)} className="rounded-lg border px-3 py-1.5 hover:bg-gray-100">Edit</button>
                <button onClick={() => remove(p)} className="rounded-lg border px-3 py-1.5 text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}