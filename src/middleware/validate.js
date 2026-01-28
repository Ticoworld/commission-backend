const { ZodError } = require('zod');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      if (!schema) return next();
      const data = req[source] || {};
      // Diagnostic logging: ensure `schema` looks like a Zod schema
      try {
        console.error('validate middleware: schema type:', typeof schema, 'has parse:', !!(schema && schema.parse));
      } catch (logErr) {
        console.error('validate middleware: error checking schema:', logErr);
      }

      // Zod v4's parse relies on `this` being the schema instance.
      // Using `.call(schema, ...)` guards against any accidental unbound method usage.
      const parsed = schema.parse.call(schema, data);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Log full Zod issues to help debugging
        console.error('Zod validation error (validate middleware):', err.issues);
        // Provide both the issues array and flattened format for clients
        const details = { issues: err.issues, flattened: err.flatten ? err.flatten() : undefined };
        return res.status(400).json({ message: 'Validation failed', details });
      }
      next(err);
    }
  };
}

module.exports = validate;