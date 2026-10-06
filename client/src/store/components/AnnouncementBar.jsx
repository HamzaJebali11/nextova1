import { useStore } from '../storeContext'

export default function AnnouncementBar() {
  const { settings, lang } = useStore()
  const bar = settings.announcementBar
  const text = bar?.[lang] || bar?.en
  if (!bar?.enabled || !text) return null
  return (
    <div className="bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white">{text}</div>
  )
}