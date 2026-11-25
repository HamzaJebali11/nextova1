import Order from '../modules/orders/order.model.js'
import Customer from '../modules/customers/customer.model.js'
import { phoneKey, phoneMatch } from './phone.js'

const DAY = 24 * 60 * 60 * 1000

// Checks made when an order is created. They are stored on the order for you only:
// the order is never refused and the customer never sees anything different.
//   failedBefore: failed orders ("Failed / returned") already on this phone number (old formats included)
//   duplicate:    another order from the same phone in the last 24 hours that is not cancelled
//   blocked:      the phone is on your block list (Customers page or order panel)
export async function orderFlags(phone, now = new Date()) {
  const key = phoneKey(phone)
  if (!key) return { failedBefore: 0, duplicate: false, blocked: false }
  const same = phoneMatch(key)
  const [failedBefore, dup, customer] = await Promise.all([
    Order.countDocuments({ ...same, status: 'returned' }),
    Order.findOne({ ...same, status: { $ne: 'cancelled' }, createdAt: { $gte: new Date(now.getTime() - DAY) } })
      .sort({ createdAt: -1 }).select('orderNumber').lean(),
    Customer.findOne({ key }).select('blocked').lean(),
  ])
  return {
    failedBefore,
    duplicate: !!dup,
    duplicateOf: dup?.orderNumber,
    blocked: !!customer?.blocked,
  }
}

export const isFlagged = (f) => !!f && (f.failedBefore > 0 || f.duplicate || f.blocked)

// Mongo condition for the "Flagged" filter
export const FLAGGED = { $or: [{ 'flags.failedBefore': { $gt: 0 } }, { 'flags.duplicate': true }, { 'flags.blocked': true }] }
