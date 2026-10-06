export function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' })
}

export function errorHandler(err, req, res, next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    })
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value', fields: Object.keys(err.keyValue || {}) })
  }
  if (err.name === 'CastError' || err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message })
  }
  const status = err.status || 500
  if (status === 500) console.error(err)
  res.status(status).json({
    message: status === 500 && process.env.NODE_ENV === 'production' ? 'Server error' : err.message,
  })
}