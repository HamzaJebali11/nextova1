import { createContext, useContext } from 'react'
import Reveal from './Reveal'

// Inside a <SectionStack> (the product page's single column) every Section sits flush: no own width,
// side padding or top margin; the stack sets one width and the spacing between sections.
const StackCtx = createContext(false)

export function SectionStack({ children, className = '' }) {
  return (
    <StackCtx.Provider value={true}>
      <div className={className}>{children}</div>
    </StackCtx.Provider>
  )
}

// One page section on the white storefront: its own rounded container with a soft shadow, a consistent
// heading (same size, weight and spacing everywhere) and the same spacing between sections.
// The container fades in calmly when it scrolls into view (Reveal; never in the first screen).
export default function Section({ id, title, action, headingRef, children, flush = false, className = '', bodyClass = 'p-6 md:p-8' }) {
  const inStack = useContext(StackCtx)
  const bare = flush || inStack
  return (
    <Reveal as="section" id={id} className={`scroll-mt-28 ${bare ? '' : 'mx-auto mt-8 max-w-[1180px] px-4 md:mt-12 md:px-6'} ${className}`}>
      <div className={`rounded-2xl border border-line bg-white shadow-e1 ${bodyClass}`}>
        {(title || action) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            {title && <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-xl font-bold leading-tight tracking-tight outline-none md:text-[22px]">{title}</h2>}
            {action}
          </div>
        )}
        {children}
      </div>
    </Reveal>
  )
}
