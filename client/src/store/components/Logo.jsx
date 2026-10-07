import { optimizeImg } from '../../lib/image'
import { useStore } from '../storeContext'

export default function Logo({ size = 'h-10 w-10', textClass = 'text-xl' }) {
  const { settings } = useStore()
  const name = settings.storeName || 'Nextova'

  return (
    <span className="flex items-center gap-2.5">
      <span className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-base font-extrabold text-white shadow ring-2 ring-white`}>
        {settings.logoUrl
          ? <img src={optimizeImg(settings.logoUrl, 160)} alt={name} className="h-full w-full object-cover" />
          : name.charAt(0).toUpperCase()}
      </span>
      <span className={`${textClass} font-extrabold tracking-tight`}>
        {name}<span className="text-emerald-500">.</span>
      </span>
    </span>
  )
}