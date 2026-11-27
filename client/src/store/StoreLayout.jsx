import { lazy, Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { captureUtm } from '../lib/utm'
import { trackVisit } from '../lib/track'
import { livePage } from '../lib/live'
import AnnouncementBar from './components/AnnouncementBar'
import Header from './components/Header'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'
import CartDrawer from './components/CartDrawer'
import PixelTracker from './components/PixelTracker'
import { whenIdle } from '../lib/idle'

// non-essential extras: their code downloads and runs only after the page is idle or on the first interaction
const RecentOrderPopup = lazy(() => whenIdle().then(() => import('./components/RecentOrderPopup')))
const ExitOffer = lazy(() => whenIdle().then(() => import('./components/ExitOffer')))
import ClarityLoader from './components/ClarityLoader'

export default function StoreLayout() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    captureUtm()
  }, [])

  useEffect(() => {
    trackVisit(pathname)
  }, [pathname])

  // live visitors heartbeat (anonymous, after the page is idle; see lib/live.js)
  useEffect(() => {
    livePage(pathname, search)
  }, [pathname, search])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="nx-store flex min-h-screen flex-col bg-white text-ink">
      <AnnouncementBar />
      <Header />
      <main className="min-h-[100svh] flex-1">{/* at least one screen: the footer never shows (and then jumps) while a page loads */}
        <div key={pathname}>
          <Suspense fallback={<div className="nx-page min-h-[60vh] animate-pulse py-8"><div className="h-64 rounded-3xl bg-gray-200" /></div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      <WhatsAppButton />
      <Suspense fallback={null}><RecentOrderPopup /></Suspense>
      <CartDrawer />
      <PixelTracker />
      <Suspense fallback={null}><ExitOffer /></Suspense>
      <ClarityLoader />
    </div>
  )
}