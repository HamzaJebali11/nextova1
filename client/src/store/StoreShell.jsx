import { StoreProvider } from './StoreProvider'
import { CartProvider } from '../cart/CartProvider'
import StoreLayout from './StoreLayout'

export default function StoreShell() {
  return (
    <StoreProvider>
      <CartProvider>
        <StoreLayout />
      </CartProvider>
    </StoreProvider>
  )
}