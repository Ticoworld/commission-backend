const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

const newsSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  // Accept either comma-separated string or array of strings
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});

function normalizeTags(tags) {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((s) => s.trim()).filter(Boolean);
  return undefined;
}

async function list(req, res) {
  const { status, authorId } = req.query;
  const where = { ...(status ? { status } : {}), ...(authorId ? { authorId } : {}) };
  const items = await prisma.news.findMany({ where, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } });
  const shaped = items.map(({ author, ...rest }) => ({ ...rest, authorName: author?.name || null }));
  res.json(shaped);
}

async function get(req, res) {
  const item = await prisma.news.findUnique({ where: { id: req.params.id }, include: { author: { select: { name: true } } } });
  if (!item) return res.status(404).json({ message: 'News not found' });
  const { author, ...rest } = item;
  res.json({ ...rest, authorName: author?.name || null });
}

async function create(req, res) {
  const parsed = newsSchema.parse(req.body);
  const item = await prisma.news.create({ data: { ...parsed, tags: normalizeTags(parsed.tags), status: 'draft', authorId: req.user.id } });
  res.status(201).json(item);
}

async function update(req, res) {
  const data = newsSchema.partial().parse(req.body);
  const item = await prisma.news.update({ where: { id: req.params.id }, data: { ...data, ...(data.tags !== undefined ? { tags: normalizeTags(data.tags) } : {}) } });
  res.json(item);
}

async function submit(req, res) {
  const id = req.params.id;
  const item = await prisma.news.update({ where: { id }, data: { status: 'pending', rejectionNotes: null } });
  await prisma.auditQueue.upsert({
    where: { id },
    update: { entityType: 'news', entityId: id, status: 'pending', entityName: item.title, submittedById: req.user.id, submittedByName: req.user.name },
    create: { id, entityType: 'news', entityId: id, status: 'pending', entityName: item.title, submittedById: req.user.id, submittedByName: req.user.name },
  });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'submit', entityType: 'news', entityId: id, entityName: item.title });
  res.json({ message: 'Submitted for approval' });
}

async function approve(req, res) {
  const id = req.params.id;
  const item = await prisma.news.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  await prisma.auditQueue.delete({ where: { id } }).catch(() => {});
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'approve', entityType: 'news', entityId: id, entityName: item.title });
  res.json({ message: 'Approved and published' });
}

async function reject(req, res) {
  const id = req.params.id;
  const item = await prisma.news.update({ where: { id }, data: { status: 'draft' } });
  await prisma.auditQueue.delete({ where: { id } }).catch(() => {});
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'reject', entityType: 'news', entityId: id, entityName: item.title });
  res.json({ message: 'Rejected' });
}

module.exports = { list, get, create, update, submit, approve, reject };
