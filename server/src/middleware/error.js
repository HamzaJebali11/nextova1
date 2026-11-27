import { recordError } from '../utils/errorLog.js'

export function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' })
}

export function errorHandler(err, req, res, next) {
  // a response was already (partly) sent: let Express close it instead of answering twice
  if (res.headersSent) return next(err)
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' })
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large' })
  if (err.name === 'ZodError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    })
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value', fields: Object.keys(err.keyValue || {}) })
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path || 'a field'}` })
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message })),
    })
  }
  const status = err.status || 500
  if (status >= 500) {
    console.error(err)
    recordError({ source: 'server', message: err.message, route: `${req.method} ${req.baseUrl || ''}${req.path || ''}` })
  }
  res.status(status).json({
    // internal error details stay in the server log (shown to the client only in development)
    message: status >= 500 && process.env.NODE_ENV !== 'development' ? 'Server error' : err.message,
    ...(status < 500 && err.messageAr ? { messageAr: err.messageAr } : {}),
  })
}