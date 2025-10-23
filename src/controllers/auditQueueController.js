const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

async function list(req, res) {
  const status = req.query.status || 'pending';
  const items = await prisma.auditQueue.findMany({ where: { status }, orderBy: { submittedAt: 'desc' } });
  res.json(items);
}

const notesSchema = z.object({ notes: z.string().optional() });

async function approve(req, res) {
  const { notes } = notesSchema.parse(req.body || {});
  const id = req.params.id;
  const item = await prisma.auditQueue.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ message: 'Queue item not found' });

  if (item.entityType === 'news') {
    const news = await prisma.news.update({ where: { id: item.entityId }, data: { status: 'published', publishedAt: new Date(), rejectionNotes: null } });
    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'approve', entityType: 'news', entityId: news.id, entityName: news.title, details: { notes } });
  } else if (item.entityType === 'employeeEdit') {
    const edit = await prisma.employeeEdit.update({ where: { id: item.entityId }, data: { status: 'approved', reviewerId: req.user.id, notes, resolvedAt: new Date() } });
    await prisma.employee.update({ where: { id: edit.employeeId }, data: edit.changes });
    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'approve', entityType: 'employeeEdit', entityId: edit.id, details: { notes } });
  }
  await prisma.auditQueue.delete({ where: { id } });
  res.json({ message: 'Approved' });
}

async function reject(req, res) {
  const { notes } = notesSchema.parse(req.body || {});
  const id = req.params.id;
  const item = await prisma.auditQueue.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ message: 'Queue item not found' });

  if (item.entityType === 'news') {
    const news = await prisma.news.update({ where: { id: item.entityId }, data: { status: 'draft', rejectionNotes: notes || null } });
    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'reject', entityType: 'news', entityId: news.id, entityName: news.title, details: { notes } });
  } else if (item.entityType === 'employeeEdit') {
    await prisma.employeeEdit.update({ where: { id: item.entityId }, data: { status: 'rejected', reviewerId: req.user.id, notes, resolvedAt: new Date() } });
    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'reject', entityType: 'employeeEdit', entityId: item.entityId, details: { notes } });
  }
  await prisma.auditQueue.delete({ where: { id } });
  res.json({ message: 'Rejected' });
}

module.exports = { list, approve, reject };