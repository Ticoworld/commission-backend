const { z } = require('zod');
const prisma = require('../db/prisma');

const createSchema = z.object({ title: z.string().min(1), content: z.string().min(1) });

async function list(req, res) {
  const items = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(items);
}

async function create(req, res) {
  const data = createSchema.parse(req.body);
  const item = await prisma.announcement.create({ data });
  res.status(201).json(item);
}

module.exports = { list, create };
