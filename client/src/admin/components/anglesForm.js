// Ad angles: conversion between the saved product and the admin form

export const blankAngle = () => ({
  slug: '', headline: { en: '', ar: '' }, subheadline: { en: '', ar: '' }, bullets: { en: '', ar: '' }, image: '',
})

// from the saved product to the form (bullets edited as one line each)
export const anglesToForm = (list = []) =>
  list.map((a) => ({
    slug: a.slug || '',
    headline: { en: a.headline?.en || '', ar: a.headline?.ar || '' },
    subheadline: { en: a.subheadline?.en || '', ar: a.subheadline?.ar || '' },
    bullets: { en: (a.bullets?.en || []).join('\n'), ar: (a.bullets?.ar || []).join('\n') },
    image: a.image || '',
  }))

// from the form to what is saved
export const anglesToPayload = (list = []) =>
  list
    .filter((a) => a.slug.trim())
    .map((a) => ({
      slug: a.slug.trim().replace(/-+$/, ''),
      headline: a.headline,
      subheadline: a.subheadline,
      bullets: {
        en: a.bullets.en.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6),
        ar: a.bullets.ar.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 6),
      },
      image: a.image || undefined,
    }))
