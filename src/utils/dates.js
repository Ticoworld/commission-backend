function daysUntil(date) {
  const target = new Date(date);
  const now = new Date();
  const diff = target.setHours(0,0,0,0) - now.setHours(0,0,0,0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function priorityForRetirement(date) {
  const days = daysUntil(date);
  if (days <= 30) return 'critical';
  if (days <= 90) return 'warning';
  if (days <= 180) return 'normal';
  if (days <= 365) return 'low';
  return 'low';
}

module.exports = { daysUntil, formatDate, priorityForRetirement };