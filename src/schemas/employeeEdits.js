const { z } = require('zod');

/**
 * Validation schema for employee edit suggestions
 * 
 * Expected format:
 * {
 *   employeeId: "uuid",
 *   changes: { 
 *     field_name: "new_value",
 *     another_field: "another_value"
 *   },
 *   reason: "Description of why this change is needed"
 * }
 * 
 * The 'changes' object is stored directly in the database as JSON.
 */
const employeeEditsSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID format'),
  changes: z
    // Zod v4 requires both key schema and value schema for records.
    // Using only one argument causes runtime parse errors.
    .record(z.string(), z.any())
    .refine(
      (obj) => obj && Object.keys(obj).length > 0,
      {
        message: 'changes must contain at least one field to update'
      }
    ),
  reason: z.string().min(1, 'Reason is required and cannot be empty')
});

module.exports = { employeeEditsSchema };
