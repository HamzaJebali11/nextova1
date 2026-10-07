import { Link } from 'react-router-dom'
import { useStore } from '../storeContext'
import Logo from './Logo'
import { WhatsAppIcon } from './icons'

const year = new Date().getFullYear()

export default function Footer() {
  const { t, pick, settings, categories } = useStore()
  const top = categories.filter((c) => !c.parent).slice(0, 6)
  const social = settings.social || {}
  const links = [['Facebook', social.facebook], ['Instagram', social.instagram], ['TikTok', social.tiktok]]
    .filter(([, url]) => url)
  const name = settings.storeName || 'Nextova'

  return (
    <footer className="mt-12 bg-gray-900 text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="text-white"><Logo /></div>
          <p className="mt-4 max-w-xs text-sm text-gray-400">{t('heroSub')}</p>
          {settings.whatsappNumber && (
            <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
              <WhatsAppIcon size={20} /> {t('chatWhatsapp')}
            </a>
          )}
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">{t('quickLinks')}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="transition hover:text-white">{t('home')}</Link></li>
            <li><Link to="/shop" className="transition hover:text-white">{t('shop')}</Link></li>
            <li><Link to="/shop?onSale=true" className="transition hover:text-white">{t('onSale')}</Link></li>
            <li><Link to="/shop?sort=newest" className="transition hover:text-white">{t('newArrivals')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">{t('categories')}</h4>
          <ul className="space-y-2 text-sm">
            {top.map((c) => (
              <li key={c._id}>
                <Link to={`/shop?category=${c.slug}`} className="transition hover:text-white">{pick(c.name)}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-semibold text-white">{t('contact')}</h4>
          <ul className="space-y-2 text-sm">
            <li>{t('codTitle')}</li>
            <li>{t('fastTitle')} · {t('fastSub')}</li>
            {links.map(([label, url]) => (
              <li key={label}>
                <a href={url} target="_blank" rel="noreferrer" className="transition hover:text-white">{label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-gray-500">
        © {year} {name}. {t('rights')}.
      </div>
    </footer>
  )
}