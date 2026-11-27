import { Link } from 'react-router-dom'
import { usePageMeta } from '../../lib/seo'
import { useStore } from '../storeContext'

// Shown for every address the store does not know (instead of silently jumping to the home page)
export default function NotFound() {
  const { t, settings } = useStore()
  usePageMeta({ title: `${t('pageNotFound')} | ${settings.storeName || 'Nextova'}`, robots: 'noindex' })
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center md:px-6">
      <div className="glass glass-sheen rounded-[24px] px-6 py-12">
      <p className="text-5xl font-extrabold text-gray-300" aria-hidden="true">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t('pageNotFound')}</h1>
      <p className="mt-2 text-gray-600">{t('pageNotFoundSub')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary-glass px-6">
          {t('home')}
        </Link>
        <Link to="/shop" className="glass-btn px-6">
          {t('shop')}
        </Link>
      </div>
      </div>
    </div>
  )
}
