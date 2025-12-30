const { ZodError } = require('zod');

function notFound(req, res, next) {
  res.status(404).json({ message: 'Not Found' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line
  console.error('Error handler caught error:', err);
  const status = err instanceof ZodError ? 400 : (err.status || 500);
  const code = err.code;
  let details = err.details;
  if (err instanceof ZodError) {
    // Prefer the issues array (Zod v4+) and include flattened structure for convenience
    console.error('ZodError issues:', err.issues);
    details = { issues: err.issues, flattened: err.flatten ? err.flatten() : undefined };
  }
  res.status(status).json({
    message: err instanceof ZodError ? 'Validation failed' : (err.message || 'Internal Server Error'),
    ...(code ? { code } : {}),
    ...(details ? { details } : {})
  });
}

module.exports = { notFound, errorHandler };