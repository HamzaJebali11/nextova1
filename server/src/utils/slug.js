import slugify from 'slugify'

export async function uniqueSlug(Model, text, currentId) {
  const base = slugify(text, { lower: true, strict: true }) || 'item'
  let slug = base
  let n = 1
  while (await Model.exists({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) })) {
    slug = `${base}-${++n}`
  }
  return slug
}