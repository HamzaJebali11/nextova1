import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { TEMPLATES } from '../pageTemplates'
import { FilterChip, ListTable, PageHeader, SearchBox, SidePanel, Tag, Th, Toolbar } from '../components/ListKit'
import { btn } from '../components/listStyles'

const blank = { title: { en: '', ar: '' }, slug: '', content: { en: '', ar: '' }, isActive: false, showInFooter: true, sortOrder: 0 }
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'
const hasPlaceholders = (p) => /\[[A-Z ]+/.test(p.content?.en || '')

export default function Pages() {
  const [list, setList] = useState(null)
  const [f, setF] = useState(blank)
  const [editing, setEditing] = useState(null) // null = closed, 'new' or the page id
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState('all') // all | published | draft
  const [q, setQ] = useState('')

  const load = () => api('/pages/admin/all').then(setList)
  useEffect(() => { load().catch(() => setList([])) }, [])

  async function addStarters() {
    setBusy(true)
    try {
      const have = new Set((list || []).map((p) => p.slug))
      for (const tpl of TEMPLATES) {
        if (!have.has(tpl.slug)) await api('/pages', { method: 'POST', body: { ...tpl, isActive: false, showInFooter: true } })
      }
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  function edit(p) {
    setError('')
    setEditing(p._id)
    setF({
      title: { en: p.title?.en || '', ar: p.title?.ar || '' },
      slug: p.slug,
      content: { en: p.content?.en || '', ar: p.content?.ar || '' },
      isActive: p.isActive,
      showInFooter: p.showInFooter,
      sortOrder: p.sortOrder || 0,
    })
  }

  function startNew() {
    setError('')
    setF(blank)
    setEditing('new')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const body = { ...f, sortOrder: Number(f.sortOrder) || 0 }
    try {
      if (editing && editing !== 'new') await api(`/pages/${editing}`, { method: 'PUT', body })
      else await api('/pages', { method: 'POST', body })
      setEditing(null)
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

  const all = list || []
  const needle = q.trim().toLowerCase()
  const rows = all.filter((p) =>
    (show === 'all' || (show === 'published' ? p.isActive : !p.isActive)) &&
    (!needle || [p.title?.en, p.title?.ar, p.slug].some((x) => (x || '').toLowerCase().includes(needle)))
  )

  return (
    <div>
      <PageHeader
        title="Pages"
        subtitle="Starter pages are saved as unpublished drafts with [PLACEHOLDERS] you must replace with your real details. Publish a page only when it is finished. Format: ## Heading, - bullet, and a blank line for a new paragraph. Check the wording matches your real practices (this is not legal advice)."
        actions={<>
          <button onClick={addStarters} disabled={busy} className={btn.ghost}>{busy ? 'Adding…' : 'Add starter pages'}</button>
          <button onClick={startNew} className={btn.dark}><Plus size={15} /> New page</button>
        </>}
      />

      <Toolbar>
        <FilterChip active={show === 'all'} onClick={() => setShow('all')} count={all.length}>All</FilterChip>
        <FilterChip active={show === 'published'} onClick={() => setShow('published')} count={all.filter((p) => p.isActive).length}>Published</FilterChip>
        <FilterChip active={show === 'draft'} onClick={() => setShow('draft')} count={all.filter((p) => !p.isActive).length}>Drafts</FilterChip>
        <SearchBox value={q} onChange={setQ} placeholder="Title or link" className="w-full md:ms-auto md:w-64" />
      </Toolbar>

      <ListTable colSpan={5} loading={!list} empty={rows.length === 0 && 'No pages here.'} minWidth="44rem"
        head={<><Th>Title</Th><Th>Link</Th><Th>Status</Th><Th>Footer · order</Th><Th end>Actions</Th></>}>
        {rows.map((p) => (
          <tr key={p._id} onClick={() => edit(p)} className="cursor-pointer align-top hover:bg-gray-50">
            <td className="p-3">
              <div className="font-semibold">{p.title.en}</div>
              {p.title.ar && <div className="text-xs text-gray-500" dir="rtl">{p.title.ar}</div>}
              {hasPlaceholders(p) && <Tag tone="danger" className="mt-1">still has [PLACEHOLDERS]</Tag>}
            </td>
            <td className="p-3 font-mono text-xs text-gray-600">/page/{p.slug}</td>
            <td className="p-3" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => togglePublished(p)} title="Switch published / draft">
                <Tag tone={p.isActive ? 'ink' : 'muted'}>{p.isActive ? 'Published' : 'Draft'}</Tag>
              </button>
            </td>
            <td className="p-3 text-gray-600">{p.showInFooter ? 'In footer' : 'Hidden'} · {p.sortOrder || 0}</td>
            <td className="p-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end gap-2">
                <button onClick={() => edit(p)} className={btn.ghost} aria-label={`Edit ${p.title.en}`}><Pencil size={14} /> Edit</button>
                <button onClick={() => remove(p)} className={btn.danger} aria-label={`Delete ${p.title.en}`}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </ListTable>

      <AnimatePresence>
        {editing && (
          <SidePanel key={editing} title={editing === 'new' ? 'New page' : 'Edit page'} onClose={() => setEditing(null)} width="max-w-3xl">
            <form onSubmit={submit} className="space-y-3">
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
                <textarea rows={14} placeholder="Content (English)" className={inputCls} value={f.content.en}
                  onChange={(e) => setF({ ...f, content: { ...f.content, en: e.target.value } })} />
                <textarea dir="rtl" rows={14} placeholder="المحتوى (Arabic, optional)" className={inputCls} value={f.content.ar}
                  onChange={(e) => setF({ ...f, content: { ...f.content, ar: e.target.value } })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Published</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={f.showInFooter} onChange={(e) => setF({ ...f, showInFooter: e.target.checked })} /> Show in footer</label>
                  <label className="flex items-center gap-2">Order <input type="number" className="w-20 rounded-lg border px-2 py-1" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></label>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(null)} className={btn.ghost}>Cancel</button>
                  <button className={btn.save}>{editing === 'new' ? 'Add page' : 'Save page'}</button>
                </div>
              </div>
            </form>
          </SidePanel>
        )}
      </AnimatePresence>
    </div>
  )
}
