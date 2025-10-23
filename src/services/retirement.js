const prisma = require('../db/prisma');
const { daysUntil, formatDate, priorityForRetirement } = require('../utils/dates');

async function computeRetirementAlerts({ priority, department } = {}) {
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 365);
  const where = {
    retirementDate: { lte: maxDate },
    ...(department ? { department } : {}),
  };
  const employees = await prisma.employee.findMany({ where });
  const alerts = employees.map((e) => {
    const days = daysUntil(e.retirementDate);
    const pr = priorityForRetirement(e.retirementDate);
    return {
      employeeId: e.id,
      name: e.name,
      department: e.department,
      retirementDate: formatDate(e.retirementDate),
      daysUntil: days,
      priority: pr,
    };
  }).filter((a) => (priority ? a.priority === priority : true));
  return alerts.sort((a, b) => a.daysUntil - b.daysUntil);
}

async function exportAlerts(format, filters) {
  const alerts = await computeRetirementAlerts(filters);
  if (format === 'csv') {
    const header = 'employeeId,name,department,retirementDate,daysUntil,priority';
    const rows = alerts.map((a) => [a.employeeId, a.name, a.department, a.retirementDate, a.daysUntil, a.priority]
      .map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
    return [header, ...rows].join('\n');
  }
  // default JSON
  return JSON.stringify(alerts, null, 2);
}

module.exports = { computeRetirementAlerts, exportAlerts };