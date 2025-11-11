const prisma = require('../db/prisma');
const { daysUntil, formatDate, priorityForRetirement } = require('../utils/dates');

async function computeRetirementAlerts({ priority, department } = {}) {
  // Alert window: next 12 months
  const now = new Date();
  const alertWindow = new Date();
  alertWindow.setFullYear(alertWindow.getFullYear() + 1);

  // Cutoff dates for hitting 60 years of age or 35 years of service within window
  const ageCutoffDate = new Date(alertWindow);
  ageCutoffDate.setFullYear(alertWindow.getFullYear() - 60);

  const serviceCutoffDate = new Date(alertWindow);
  serviceCutoffDate.setFullYear(alertWindow.getFullYear() - 35);

  const where = {
    AND: [
      department ? { department } : {},
      {
        OR: [
          // Will turn 60 by the end of alert window
          { date_of_birth: { lte: ageCutoffDate } },
          // Will reach 35 years of service by the end of alert window
          { date_of_first_appointment: { lte: serviceCutoffDate } },
        ],
      },
    ],
  };

  const employees = await prisma.employee.findMany({ where });

  function addYears(date, years) {
    if (!date) return null;
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  const alerts = employees
    .map((e) => {
      const ageRetirementDate = addYears(e.date_of_birth, 60);
      const serviceRetirementDate = addYears(e.date_of_first_appointment, 35);
      const dates = [ageRetirementDate, serviceRetirementDate].filter(Boolean);
      if (dates.length === 0) return null;
      const retirementDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      return { e, retirementDate };
    })
    .filter(Boolean)
    // Ensure the retirement date is within the alert window and not in the past
    .filter(({ retirementDate }) => retirementDate >= now && retirementDate <= alertWindow)
    .map(({ e, retirementDate }) => {
      const days = daysUntil(retirementDate);
      const pr = priorityForRetirement(retirementDate);
      return {
        employeeId: e.id,
        name: e.name,
        department: e.department,
        retirementDate: formatDate(retirementDate),
        daysUntil: days,
        priority: pr,
      };
    })
    .filter((a) => (priority ? a.priority === priority : true));

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