import { Link } from 'react-router-dom'
import { useStore } from '../storeContext'

const year = new Date().getFullYear()

export default function Footer() {
  const { t, pick, settings, categories } = useStore()
  const top = categories.filter((c) => !c.parent).slice(0, 5)
  const social = settings.social || {}
  const links = [['Facebook', social.facebook], ['Instagram', social.instagram], ['TikTok', social.tiktok]]
    .filter(([, url]) => url)
  const name = settings.storeName || 'Nextova'

  return (
    <footer className="mt-16 border-t bg-gray-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="text-xl font-extrabold">{name}<span className="text-emerald-500">.</span></div>
          <p className="mt-2 max-w-xs text-sm text-gray-500">{t('heroSub')}</p>
        </div>

        <div>
          <h4 className="mb-3 font-semibold">{t('quickLinks')}</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><Link to="/shop" className="hover:text-emerald-600">{t('shop')}</Link></li>
            {top.map((c) => (
              <li key={c._id}><Link to={`/shop?category=${c.slug}`} className="hover:text-emerald-600">{pick(c.name)}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-3 font-semibold">{t('contact')}</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            {settings.whatsappNumber && (
              <li>
                <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer"
                  className="hover:text-emerald-600">{t('chatWhatsapp')}</a>
              </li>
            )}
            {links.map(([label, url]) => (
              <li key={label}><a href={url} target="_blank" rel="noreferrer" className="hover:text-emerald-600">{label}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-gray-500">
        © {year} {name}. {t('rights')}.
      </div>
    </footer>
  )
}