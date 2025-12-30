const { z } = require('zod');

const batchSchema = z.object({
  employeeId: z.string().uuid(),
  // z.record doesn't support `.min()`; require at least one key with a refine
  changes: z.record(z.any()).refine(obj => obj && Object.keys(obj).length > 0, {
    message: 'changes must contain at least one field'
  }),
  reason: z.string().min(1)
});

const singleSchema = z.object({
  employeeId: z.string().uuid(),
  field: z.string(),
  oldValue: z.any().optional(),
  newValue: z.any(),
  reason: z.string().min(1)
});

// Accept either a batch edit (changes object) or a single field edit
const employeeEditsSchema = z.union([batchSchema, singleSchema]);

module.exports = { employeeEditsSchema };
