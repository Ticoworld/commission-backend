const { z } = require('zod');
const prisma = require('../db/prisma');

const createSchema = z.object({ name: z.string().min(1), code: z.string().min(1) });

async function list(req, res) {
  try {
    const items = await prisma.lGA.findMany({ orderBy: { name: 'asc' } });
    // Standardized response format matching other endpoints
    res.json({ data: items, meta: { total: items.length } });
  } catch (error) {
    console.error('Error fetching LGAs:', error);
    // Return empty array instead of crashing
    res.status(500).json({ 
      data: [], 
      meta: { total: 0 },
      error: 'Failed to fetch local governments' 
    });
  }
}

async function create(req, res) {
  const data = createSchema.parse(req.body);
  const item = await prisma.lGA.create({ data });
  res.status(201).json(item);
}

async function update(req, res) {
  const data = createSchema.partial().parse(req.body);
  const item = await prisma.lGA.update({ where: { id: req.params.id }, data });
  res.json(item);
}

module.exports = { list, create, update };
