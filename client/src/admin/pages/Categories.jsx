import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const blank = { name: { en: '', ar: '' }, parent: '', sortOrder: 0, isActive: true }
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

export default function Categories() {
  const [list, setList] = useState([])
  const [f, setF] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')

  const load = () => api('/categories/admin/all').then(setList)
  useEffect(() => { load() }, [])

  function edit(c) {
    setEditId(c._id)
    setF({
      name: { en: c.name.en, ar: c.name.ar || '' },
      parent: c.parent || '',
      sortOrder: c.sortOrder || 0,
      isActive: c.isActive,
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
    const body = { name: f.name, parent: f.parent || null, sortOrder: Number(f.sortOrder) || 0, isActive: f.isActive }
    try {
      if (editId) await api(`/categories/${editId}`, { method: 'PUT', body })
      else await api('/categories', { method: 'POST', body })
      reset()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(c) {
    if (!confirm(`Delete category "${c.name.en}"? Its products stay, but lose this category.`)) return
    try {
      await api(`/categories/${c._id}`, { method: 'DELETE' })
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const nameOf = (id) => list.find((c) => c._id === id)?.name.en

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Categories</h1>

      <form onSubmit={submit} className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">{editId ? 'Edit category' : 'Add category'}</h2>
        {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input required placeholder="Name (English)" className={inputCls} value={f.name.en}
            onChange={(e) => setF({ ...f, name: { ...f.name, en: e.target.value } })} />
          <input dir="rtl" placeholder="الاسم (Arabic)" className={inputCls} value={f.name.ar}
            onChange={(e) => setF({ ...f, name: { ...f.name, ar: e.target.value } })} />
          <select className={inputCls} value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })}>
            <option value="">No parent (main category)</option>
            {list.filter((c) => c._id !== editId && !c.parent).map((c) => (
              <option key={c._id} value={c._id}>{c.name.en}</option>
            ))}
          </select>
          <input type="number" placeholder="Sort order" className={inputCls} value={f.sortOrder}
            onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
            Visible in the store
          </label>
          <div className="flex gap-2">
            {editId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 hover:bg-gray-100">Cancel</button>}
            <button className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">{editId ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {list.length === 0 && <div className="p-6 text-gray-500">No categories yet.</div>}
        <ul className="divide-y">
          {list.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">
                  {c.parent && <span className="text-gray-400">{nameOf(c.parent)} › </span>}
                  {c.name.en} {c.name.ar && <span className="text-gray-400">· {c.name.ar}</span>}
                </div>
                <div className="text-xs text-gray-500">Order {c.sortOrder} · {c.isActive ? 'Visible' : 'Hidden'} · /{c.slug}</div>
              </div>
              <div className="flex gap-2 text-sm">
                <button onClick={() => edit(c)} className="rounded-lg border px-3 py-1.5 hover:bg-gray-100">Edit</button>
                <button onClick={() => remove(c)} className="rounded-lg border px-3 py-1.5 text-red-600 hover:bg-red-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}