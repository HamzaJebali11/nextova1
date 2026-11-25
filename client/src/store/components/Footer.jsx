import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, Languages } from 'lucide-react'
import { api } from '../../lib/api'
import { useStore } from '../storeContext'
import Logo from './Logo'
import { WhatsAppIcon } from './icons'

const year = new Date().getFullYear()
const linkCls = 'inline-flex min-h-11 min-w-11 items-center text-sm text-gray-700 hover:text-ink hover:underline underline-offset-2'

// Footer: store info (with the CR number from Settings), Categories, Get to know us (About, Terms, Privacy),
// Help (Contact, WhatsApp, Returns), copyright and language switch. No payment card icons: "Cash on delivery".
export default function Footer() {
  const { t, lang, pick, settings, categories, toggleLang } = useStore()
  const [pages, setPages] = useState([])

  useEffect(() => {
    let cancelled = false
    api('/pages').then((d) => { if (!cancelled) setPages(Array.isArray(d) ? d : []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const find = (word) => pages.find((p) => p.slug?.toLowerCase().includes(word))
  const about = find('about')
  const terms = find('terms')
  const privacy = find('privacy')
  const returns = find('return')
  const contact = find('contact')
  const used = new Set([about, terms, privacy, returns, contact].filter(Boolean).map((p) => p.slug))
  const otherPages = pages.filter((p) => !used.has(p.slug))
  const pageLink = (p) => p && (
    <li key={p.slug}><Link to={`/page/${p.slug}`} className={linkCls}>{pick(p.title)}</Link></li>
  )

  const top = categories.filter((c) => !c.parent).slice(0, 8)
  const social = settings.social || {}
  const socials = [['Facebook', social.facebook], ['Instagram', social.instagram], ['TikTok', social.tiktok]].filter(([, u]) => u)
  const name = settings.storeName || 'Nextova'

  return (
    <footer className="mt-12 border-t border-line bg-quiet text-ink">
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-x-6 gap-y-10 px-4 md:px-6 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-gray-600">{t('heroSub')}</p>
          {(settings.legalName || settings.crNumber) && (
            <p className="mt-3 text-xs text-gray-600">
              {settings.legalName || name}
              {settings.crNumber && <> · {lang === 'ar' ? 'السجل التجاري' : 'CR No.'} <span dir="ltr">{settings.crNumber}</span></>}
            </p>
          )}
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium">
            <Banknote size={16} aria-hidden="true" /> {t('codTitle')}
          </span>
        </div>

        <nav aria-label={t('categories')}>
          <h2 className="mb-3 text-sm font-bold">{t('categories')}</h2>
          <ul className="space-y-0.5">
            <li><Link to="/shop" className={linkCls}>{t('allProducts')}</Link></li>
            {top.map((c) => (
              <li key={c._id}><Link to={`/shop?category=${c.slug}`} className={linkCls}>{pick(c.name)}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t('getToKnowUs')}>
          <h2 className="mb-3 text-sm font-bold">{t('getToKnowUs')}</h2>
          <ul className="space-y-0.5">
            {pageLink(about)}
            {pageLink(terms)}
            {pageLink(privacy)}
            {otherPages.map(pageLink)}
            {socials.map(([label, url]) => (
              <li key={label}><a href={url} target="_blank" rel="noreferrer" className={linkCls}>{label}</a></li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t('help')}>
          <h2 className="mb-3 text-sm font-bold">{t('help')}</h2>
          <ul className="space-y-0.5">
            {pageLink(contact)}
            {settings.whatsappNumber && (
              <li>
                <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer" className={`${linkCls} gap-1.5`}>
                  <WhatsAppIcon size={16} /> {t('chatWhatsapp')}
                </a>
              </li>
            )}
            {pageLink(returns)}
            <li className="pt-1 text-sm text-gray-600">{t('trustDelivery2')}</li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 text-xs text-gray-600">
          <span>© {year} {settings.legalName || name}. {t('rights')}.</span>
          <button type="button" onClick={toggleLang}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink hover:bg-quiet">
            <Languages size={16} aria-hidden="true" /> {t('langToggle')}
          </button>
        </div>
      </div>
    </footer>
  )
}
