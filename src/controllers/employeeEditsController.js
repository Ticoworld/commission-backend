const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

const createSchema = z.object({
  employeeId: z.string().uuid(),
  changes: z.record(z.any()),
  reason: z.string().min(1),
});

async function list(req, res) {
  const { status, submittedById } = req.query;
  const where = { ...(status ? { status } : {}), ...(submittedById ? { submittedById } : {}) };
  const items = await prisma.employeeEdit.findMany({ where, orderBy: { submittedAt: 'desc' }, include: { employee: { select: { name: true } } } });
  const shaped = items.map(({ employee, ...rest }) => ({ ...rest, employeeName: employee?.name || null }));
  res.json(shaped);
}

async function create(req, res) {
  const { employeeId, changes, reason } = createSchema.parse(req.body);
  const edit = await prisma.employeeEdit.create({ data: { employeeId, changes, reason, status: 'pending', submittedById: req.user.id } });
  await prisma.auditQueue.upsert({
    where: { id: edit.id },
    update: { entityType: 'employeeEdit', entityId: edit.id, status: 'pending', submittedById: req.user.id, submittedByName: req.user.name, payload: changes },
    create: { id: edit.id, entityType: 'employeeEdit', entityId: edit.id, status: 'pending', submittedById: req.user.id, submittedByName: req.user.name, payload: changes },
  });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'submit', entityType: 'employeeEdit', entityId: edit.id, details: { reason } });
  res.status(201).json(edit);
}

module.exports = { list, create };
