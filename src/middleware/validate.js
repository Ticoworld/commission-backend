const { ZodError } = require('zod');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      if (!schema) return next();
      const data = req[source] || {};
      const parsed = schema.parse(data);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: 'Validation failed', details: err.flatten() });
      }
      next(err);
    }
  };
}

module.exports = validate;