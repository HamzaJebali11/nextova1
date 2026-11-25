import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { startPrefetch } from './lib/prefetch'
import { startErrorReporting } from './lib/errorReport'

// product and settings requests start now, while React is still starting
if (!window.location.pathname.startsWith('/admin')) startPrefetch()
// browser errors go to Admin > System status (rate limited, no customer data)
startErrorReporting()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)