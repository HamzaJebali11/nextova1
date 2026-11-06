import Product from '../modules/products/product.model.js'

// atomic, so two buyers can't take the last item
export async function reserveStock(productId, variantName, qty) {
  const res = variantName
    ? await Product.updateOne(
        { _id: productId, variants: { $elemMatch: { name: variantName, stock: { $gte: qty } } } },
        { $inc: { 'variants.$.stock': -qty, stock: -qty, soldCount: qty } })
    : await Product.updateOne(
        { _id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty, soldCount: qty } })
  return res.modifiedCount === 1
}

export async function releaseStock(productId, variantName, qty) {
  if (variantName) {
    await Product.updateOne({ _id: productId, 'variants.name': variantName },
      { $inc: { 'variants.$.stock': qty, stock: qty, soldCount: -qty } })
  } else {
    await Product.updateOne({ _id: productId }, { $inc: { stock: qty, soldCount: -qty } })
  }
}