import { useEffect } from 'react'
import { getToken } from '../../lib/api'
import { initClarity } from '../../lib/clarity'
import { useStore } from '../storeContext'

export default function ClarityLoader() {
  const { settings } = useStore()

  useEffect(() => {
    if (getToken()) return // your own visits (logged in as admin) are not recorded
    initClarity(settings.clarityId)
  }, [settings.clarityId])

  return null
}