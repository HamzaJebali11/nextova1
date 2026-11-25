import { useEffect } from 'react'
import { getToken } from '../../lib/api'
import { initClarity } from '../../lib/clarity'
import { whenIdle } from '../../lib/idle'
import { useStore } from '../storeContext'

export default function ClarityLoader() {
  const { settings } = useStore()

  useEffect(() => {
    if (getToken()) return // your own visits (logged in as admin) are not recorded
    if (!settings.clarityId) return
    // non-essential: loads after the page is idle or on the first interaction
    let cancelled = false
    whenIdle().then(() => { if (!cancelled) initClarity(settings.clarityId) })
    return () => { cancelled = true }
  }, [settings.clarityId])

  return null
}