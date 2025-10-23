const prisma = require('../db/prisma');
const { computeRetirementAlerts } = require('../services/retirement');

let cache = { data: null, expiresAt: 0 };

async function notifications(req, res) {
  const now = Date.now();
  if (cache.data && cache.expiresAt > now) {
    return res.json(cache.data);
  }
  const [pendingAudits, alerts] = await Promise.all([
    prisma.auditQueue.count({ where: { status: 'pending' } }),
    computeRetirementAlerts({ priority: 'critical' }),
  ]);
  const data = { criticalAlerts: alerts.length, pendingAudits };
  cache = { data, expiresAt: now + 60_000 }; // 60s cache
  res.json(data);
}

module.exports = { notifications };
