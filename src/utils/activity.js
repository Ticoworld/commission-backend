const prisma = require('../db/prisma');

async function logActivity({ actorId, actorName, action, entityType, entityId, entityName, details }) {
  try {
    await prisma.activity.create({
      data: { actorId, actorName, action, entityType, entityId, entityName, details },
    });
  } catch (e) {
    console.error('Failed to log activity', e.message);
  }
}

module.exports = { logActivity };