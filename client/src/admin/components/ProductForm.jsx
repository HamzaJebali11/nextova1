import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Star, X, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { uploadImage } from '../../lib/upload'
import { optimizeImg } from '../../lib/image'
import ProductExtras from './ProductExtras'
import ProductOffers from './ProductOffers'
import DescriptionImages from './DescriptionImages'
import ProductVideoField from './ProductVideo'

const blank = {
  name: { en: '', ar: '' },
  description: { en: '', ar: '' },
  descriptionImages: { en: [], ar: [] },
  video: { url: '', publicId: '' },
  category: '',
  price: '',
  compareAtPrice: '',
  costPrice: '',
  stock: 0,
  lowStockAlert: 5,
  sku: '',
  images: [],
  variants: [],
  tags: '',
  isActive: true,
  isFeatured: false,
  faqs: [],
  comparison: [],
  packs: [],
  freeGift: { enabled: false, product: '', minQty: 1, qty: 1 },
}

const cleanImages = (list) => (list || []).map(({ url, publicId }) => ({ url, publicId }))

function toForm(p) {
  if (!p) return blank
  return {
    name: { en: p.name?.en || '', ar: p.name?.ar || '' },
    description: { en: p.description?.en || '', ar: p.description?.ar || '' },
    descriptionImages: {
      en: cleanImages(p.descriptionImages?.en),
      ar: cleanImages(p.descriptionImages?.ar),
    },
    video: { url: p.video?.url || '', publicId: p.video?.publicId || '' },
    category: p.category?._id || p.category || '',
    price: p.price ?? '',
    compareAtPrice: p.compareAtPrice ?? '',
    costPrice: p.costPrice ?? '',
    stock: p.stock ?? 0,
    lowStockAlert: p.lowStockAlert ?? 5,
    sku: p.sku || '',
    images: p.images || [],
    variants: (p.variants || []).map((v) => ({ name: v.name, price: v.price ?? '', stock: v.stock ?? 0 })),
    tags: (p.tags || []).join(', '),
    isActive: p.isActive ?? true,
    isFeatured: p.isFeatured ?? false,
    faqs: (p.faqs || []).map((x) => ({
      q: { en: x.q?.en || '', ar: x.q?.ar || '' },
      a: { en: x.a?.en || '', ar: x.a?.ar || '' },
    })),
    comparison: (p.comparison || []).map((x) => ({
      feature: { en: x.feature?.en || '', ar: x.feature?.ar || '' },
      ours: { en: x.ours?.en || '', ar: x.ours?.ar || '' },
      theirs: { en: x.theirs?.en || '', ar: x.theirs?.ar || '' },
    })),
    packs: (p.packs || []).map((x) => ({
      qty: x.qty,
      price: x.price,
      badge: { en: x.badge?.en || '', ar: x.badge?.ar || '' },
    })),
    freeGift: {
      enabled: !!p.freeGift?.enabled,
      product: p.freeGift?.product?._id || p.freeGift?.product || '',
      minQty: p.freeGift?.minQty || 1,
      qty: p.freeGift?.qty || 1,
    },
  }
}

const inputCls =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900'

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

export default function ProductForm({ product, categories, onClose, onSaved }) {
  const [f, setF] = useState(() => toForm(product))
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setLang = (k, lang, v) => setF((s) => ({ ...s, [k]: { ...s[k], [lang]: v } }))
  const setVariant = (i, k, v) =>
    setF((s) => ({ ...s, variants: s.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }))

  async function addFiles(e) {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await uploadImage(file))
      setF((s) => ({ ...s, images: [...s.images, ...uploaded] }))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const makeMain = (i) =>
    setF((s) => ({ ...s, images: [s.images[i], ...s.images.filter((_, j) => j !== i)] }))
  const removeImage = (i) =>
    setF((s) => ({ ...s, images: s.images.filter((_, j) => j !== i) }))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const variants = f.variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        name: v.name.trim(),
        price: v.price === '' ? undefined : Number(v.price),
        stock: Number(v.stock) || 0,
      }))

    const payload = {
      name: f.name,
      description: f.description,
      descriptionImages: f.descriptionImages,
      video: f.video.url ? f.video : { url: '', publicId: '' },
      category: f.category || null,
      price: Number(f.price),
      compareAtPrice: f.compareAtPrice === '' ? null : Number(f.compareAtPrice),
      costPrice: Number(f.costPrice) || 0,
      stock: variants.length ? variants.reduce((sum, v) => sum + v.stock, 0) : Number(f.stock) || 0,
      lowStockAlert: Number(f.lowStockAlert) || 0,
      sku: f.sku,
      images: f.images,
      variants,
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
      isActive: f.isActive,
      isFeatured: f.isFeatured,
      faqs: f.faqs.filter((x) => x.q.en.trim() && x.a.en.trim()),
      comparison: f.comparison.filter((x) => x.feature.en.trim()),
      packs: f.packs
        .filter((x) => Number(x.qty) >= 2 && x.price !== '' && Number(x.price) >= 0)
        .map((x) => ({ qty: Number(x.qty), price: Number(x.price), badge: x.badge })),
      freeGift: {
        enabled: !!(f.freeGift.enabled && f.freeGift.product),
        product: f.freeGift.product || undefined,
        minQty: Number(f.freeGift.minQty) || 1,
        qty: Number(f.freeGift.qty) || 1,
      },
    }

    try {
      if (product) await api(`/products/${product._id}`, { method: 'PUT', body: payload })
      else await api('/products', { method: 'POST', body: payload })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const hasVariants = f.variants.length > 0

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.25 }}>
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-xl font-bold">{product ? 'Edit product' : 'Add product'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (English) *">
              <input required className={inputCls} value={f.name.en} onChange={(e) => setLang('name', 'en', e.target.value)} />
            </Field>
            <Field label="Name (Arabic)">
              <input dir="rtl" className={inputCls} value={f.name.ar} onChange={(e) => setLang('name', 'ar', e.target.value)} />
            </Field>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (QAR) *">
              <input required type="number" min="0" step="0.01" className={inputCls} value={f.price} onChange={(e) => set('price', e.target.value)} />
            </Field>
            <Field label="Old price" hint="Shows as a discount">
              <input type="number" min="0" step="0.01" className={inputCls} value={f.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} />
            </Field>
            <Field label="SKU">
              <input className={inputCls} value={f.sku} onChange={(e) => set('sku', e.target.value)} />
            </Field>
            <Field label="Stock" hint={hasVariants ? 'Calculated from variants' : undefined}>
              <input type="number" min="0" disabled={hasVariants} className={`${inputCls} disabled:bg-gray-100`}
                value={hasVariants ? f.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) : f.stock}
                onChange={(e) => set('stock', e.target.value)} />
            </Field>
            <Field label="Low-stock alert at">
              <input type="number" min="0" className={inputCls} value={f.lowStockAlert} onChange={(e) => set('lowStockAlert', e.target.value)} />
            </Field>
            <Field label="Category">
              <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">No category</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name.en}</option>)}
              </select>
            </Field>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Photos <span className="text-xs font-normal text-gray-500">(gallery at the top of the page)</span></h3>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {uploading ? 'Uploading…' : 'Add photos'}
                <input type="file" accept="image/*" multiple hidden onChange={addFiles} disabled={uploading} />
              </label>
            </div>
            {f.images.length === 0 && <p className="text-sm text-gray-500">No photos yet. The first photo is the main one.</p>}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {f.images.map((img, i) => (
                <div key={img.url} className="group relative">
                  <img src={optimizeImg(img.url, 300)} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white">Main</span>}
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    {i !== 0 && (
                      <button type="button" onClick={() => makeMain(i)} title="Make main"
                        className="rounded bg-white/90 p-1 shadow hover:bg-white"><Star size={14} /></button>
                    )}
                    <button type="button" onClick={() => removeImage(i)} title="Remove"
                      className="rounded bg-white/90 p-1 text-red-600 shadow hover:bg-white"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <ProductVideoField video={f.video} onChange={(v) => set('video', v)} />

          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">Description pictures</h3>
              <p className="text-xs text-gray-500">
                These pictures are the description on the product page, shown one under the other across the full width of the page.
                Visitors see the set for their language, or the other set if one is empty.
                Tip: 1600 to 2000 px wide, under 8 MB each, one idea per picture.
              </p>
            </div>
            <DescriptionImages title="English pictures" images={f.descriptionImages.en}
              onChange={(list) => setLang('descriptionImages', 'en', list)} />
            <DescriptionImages title="Arabic pictures (الصور بالعربية)" images={f.descriptionImages.ar}
              onChange={(list) => setLang('descriptionImages', 'ar', list)} />

            <details className="rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-medium">Text description (used only when there are no pictures)</summary>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Description (English)">
                  <textarea rows={4} className={inputCls} value={f.description.en} onChange={(e) => setLang('description', 'en', e.target.value)} />
                </Field>
                <Field label="Description (Arabic)">
                  <textarea dir="rtl" rows={4} className={inputCls} value={f.description.ar} onChange={(e) => setLang('description', 'ar', e.target.value)} />
                </Field>
              </div>
            </details>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Variants <span className="text-xs font-normal text-gray-500">(sizes, colors… optional)</span></h3>
              <button type="button" onClick={() => set('variants', [...f.variants, { name: '', price: '', stock: 0 }])}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-100"><Plus size={16} /> Add variant</button>
            </div>
            {f.variants.map((v, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-2">
                <input placeholder="Name (e.g. Red)" className={inputCls} value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} />
                <input placeholder="Price" type="number" min="0" className={inputCls} value={v.price} onChange={(e) => setVariant(i, 'price', e.target.value)} />
                <input placeholder="Stock" type="number" min="0" className={inputCls} value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} />
                <button type="button" onClick={() => set('variants', f.variants.filter((_, j) => j !== i))}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
              </div>
            ))}
            {hasVariants && <p className="text-xs text-gray-500">Variant price is optional. Leave it empty to use the main price.</p>}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Tags" hint="Comma separated, used by search">
              <input className={inputCls} value={f.tags} onChange={(e) => set('tags', e.target.value)} />
            </Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Visible in the store</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Featured on the home page</label>
            </div>
          </section>

          <ProductOffers f={f} set={set} selfId={product?._id} />
          <ProductExtras f={f} set={set} />
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 hover:bg-gray-100">Cancel</button>
          <button disabled={saving || uploading} className="rounded-lg bg-gray-900 px-5 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}