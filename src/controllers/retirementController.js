const { z } = require('zod');
const { computeRetirementAlerts, exportAlerts } = require('../services/retirement');
const { logActivity } = require('../utils/activity');

async function list(req, res) {
  const { priority, department } = req.query;
  const alerts = await computeRetirementAlerts({ priority, department });
  // Map to UI-expected shape
  const shaped = alerts.map((a) => ({
    id: a.employeeId,
    employeeId: a.employeeId,
    employeeName: a.name,
    department: a.department,
    retirementDate: a.retirementDate, // currently formatted in service
    formattedRetirementDate: a.retirementDate,
    daysRemaining: a.daysUntil,
    priority: a.priority,
  }));
  res.json(shaped);
}

const exportSchema = z.object({ format: z.enum(['pdf', 'csv']), filters: z.object({ priority: z.string().optional(), department: z.string().optional() }).optional() });
async function exportReport(req, res) {
  const { format, filters } = exportSchema.parse(req.body);
  await exportAlerts(format === 'pdf' ? 'csv' : format, filters); // CSV for now
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'export', entityType: 'retirementAlerts' });
  res.status(202).json({ message: 'Export started. You will receive an email with the report.' });
}

module.exports = { list, exportReport };
