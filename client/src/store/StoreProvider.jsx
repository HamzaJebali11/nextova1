import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { dict } from './i18n'
import { extra } from './i18nExtra'
import { StoreCtx } from './storeContext'

const merged = {
  en: { ...dict.en, ...extra.en },
  ar: { ...dict.ar, ...extra.ar },
}

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState({})
  const [categories, setCategories] = useState([])
  const [lang, setLang] = useState(() => localStorage.getItem('nx_lang') || 'en')

  useEffect(() => {
    api('/settings').then(setSettings).catch(() => {})
    api('/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('nx_lang', lang)
    return () => {
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = 'en'
    }
  }, [lang])

  const value = useMemo(() => {
    const cur = settings.currency || 'QAR'
    return {
      settings,
      categories,
      lang,
      toggleLang: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')),
      t: (key) => merged[lang]?.[key] ?? merged.en[key] ?? key,
      pick: (obj) => (obj && (obj[lang] || obj.en)) || '',
      money: (n) => {
        const v = Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
        return lang === 'ar' && cur === 'QAR' ? `${v} ر.ق` : `${cur} ${v}`
      },
    }
  }, [settings, categories, lang])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}