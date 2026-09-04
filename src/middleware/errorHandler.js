/* eslint-disable no-unused-vars */
function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || 'Something went wrong on our end.',
    ...(process.env.NODE_ENV !== 'production' ? { detail: err.message } : {})
  });
}

module.exports = { notFound, errorHandler };
