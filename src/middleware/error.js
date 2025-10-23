const { ZodError } = require('zod');

function notFound(req, res, next) {
  res.status(404).json({ message: 'Not Found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line
  console.error(err);
  const status = err instanceof ZodError ? 400 : (err.status || 500);
  const code = err.code;
  const details = err instanceof ZodError ? err.flatten() : err.details;
  res.status(status).json({ message: err instanceof ZodError ? 'Validation failed' : (err.message || 'Internal Server Error'), ...(code ? { code } : {}), ...(details ? { details } : {}) });
}

module.exports = { notFound, errorHandler };