import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'

// plain-text format: "## Heading", "- bullet", blank line = new paragraph (nothing is run as HTML)
function Content({ text }) {
  const out = []
  let list = []
  let para = []
  const flushList = () => {
    if (list.length) {
      out.push(<ul key={out.length} className="list-disc space-y-1 ps-6">{list.map((x, i) => <li key={i}>{x}</li>)}</ul>)
      list = []
    }
  }
  const flushPara = () => {
    if (para.length) {
      out.push(<p key={out.length}>{para.join(' ')}</p>)
      para = []
    }
  }
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim()
    if (!line) { flushList(); flushPara(); continue }
    if (line.startsWith('## ')) {
      flushList(); flushPara()
      out.push(<h2 key={out.length} className="pt-4 text-xl font-bold text-gray-900">{line.slice(3)}</h2>)
      continue
    }
    if (line.startsWith('- ')) { flushPara(); list.push(line.slice(2)); continue }
    flushList()
    para.push(line)
  }
  flushList(); flushPara()
  return <div className="space-y-4 leading-relaxed text-gray-700">{out}</div>
}

export default function Page() {
  const { slug } = useParams()
  const { t, pick, settings } = useStore()
  const [state, setState] = useState({ slug: null })

  useEffect(() => {
    let cancelled = false
    api(`/pages/${slug}`)
      .then((d) => { if (!cancelled) setState({ slug, page: d }) })
      .catch(() => { if (!cancelled) setState({ slug, missing: true }) })
    return () => { cancelled = true }
  }, [slug])

  const title = state.page ? pick(state.page.title) : ''
  useEffect(() => {
    if (!title) return
    const store = settings.storeName || 'Nextova'
    document.title = `${title} | ${store}`
    return () => { document.title = store }
  }, [title, settings.storeName])

  if (state.slug !== slug) {
    return <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-12"><div className="h-8 w-1/2 rounded bg-gray-200" /><div className="h-40 rounded bg-gray-200" /></div>
  }

  if (state.missing) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="mb-4 text-lg text-gray-600">{t('notFound')}</p>
        <Link to="/shop" className="rounded-full bg-gray-900 px-6 py-2.5 text-white hover:bg-emerald-600">{t('backToShop')}</Link>
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-extrabold">{title}</h1>
      <Content text={pick(state.page.content)} />
    </article>
  )
}