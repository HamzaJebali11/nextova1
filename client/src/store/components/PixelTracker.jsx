import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initPixel, pageView } from '../../lib/pixel'
import { useStore } from '../storeContext'

export default function PixelTracker() {
  const { settings } = useStore()
  const { pathname } = useLocation()

  useEffect(() => {
    initPixel(settings.pixelId)
  }, [settings.pixelId])

  useEffect(() => {
    pageView()
  }, [pathname, settings.pixelId])

  return null
}