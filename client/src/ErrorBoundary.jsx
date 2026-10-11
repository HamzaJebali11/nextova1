import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#555', marginBottom: 16 }}>Please reload the page. If it keeps happening, message us on WhatsApp.</p>
          <button onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', borderRadius: 999, background: '#111', color: '#fff', border: 0, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}