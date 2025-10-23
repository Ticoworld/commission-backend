const prisma = require('../db/prisma');

async function list(req, res) {
  const { actorId, entityType, q, startDate, endDate } = req.query;
  const where = {
    ...(actorId ? { actorId } : {}),
    ...(entityType ? { entityType } : {}),
    ...(q ? { OR: [{ action: { contains: q, mode: 'insensitive' } }, { entityName: { contains: q, mode: 'insensitive' } }] } : {}),
    ...(startDate || endDate ? { timestamp: { gte: startDate ? new Date(startDate) : undefined, lte: endDate ? new Date(endDate) : undefined } } : {}),
  };
  const items = await prisma.activity.findMany({ where, orderBy: { timestamp: 'desc' } });
  res.json(items);
}

module.exports = { list };
