const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

// Admin can manage all fields; LGA has a minimal subset
const adminCreateSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  position: z.string(),
  department: z.string(),
  employmentDate: z.coerce.date(),
  retirementDate: z.coerce.date(),
  status: z.string().optional(),
  lgaId: z.string().uuid().optional(),
});
const lgaCreateSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  position: z.string(),
});
const adminUpdateSchema = adminCreateSchema.partial();
const lgaUpdateSchema = lgaCreateSchema.partial();

function paginateParams(q) {
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '10', 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

async function list(req, res) {
  const { search, department, q } = req.query;
  const searchTerm = search || q;
  const { page, pageSize, skip, take } = paginateParams(req.query);
  const where = {
    ...(searchTerm ? { OR: [ { name: { contains: searchTerm, mode: 'insensitive' } }, { email: { contains: searchTerm, mode: 'insensitive' } } ] } : {}),
    ...(department ? { department } : {}),
  };
  const [total, data] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
  ]);
  res.json({ data, meta: { page, pageSize, total } });
}

async function byId(req, res) {
  const emp = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });
  res.json(emp);
}

async function myLga(req, res) {
  const lgaId = req.user.lgaId;
  const data = await prisma.employee.findMany({ where: { lgaId } });
  res.json(data);
}

async function create(req, res) {
  if (req.user.role === 'LGA') {
    const body = lgaCreateSchema.parse(req.body);
    const defaults = {
      department: 'Unknown',
      employmentDate: new Date(),
      retirementDate: new Date(new Date().setFullYear(new Date().getFullYear() + 30)),
      status: 'active',
    };
    const emp = await prisma.employee.create({
      data: { ...defaults, ...body, lgaId: req.user.lgaId },
    });
    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'create', entityType: 'employee', entityId: emp.id, entityName: emp.name });
    return res.status(201).json(emp);
  }

  const body = adminCreateSchema.parse(req.body);
  const emp = await prisma.employee.create({ data: { ...body, status: body.status || 'active' } });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'create', entityType: 'employee', entityId: emp.id, entityName: emp.name });
  return res.status(201).json(emp);
}

async function update(req, res) {
  const id = req.params.id;
  if (req.user.role === 'LGA') {
    const body = lgaUpdateSchema.parse(req.body);
    // Ensure ownership by LGA
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.lgaId !== req.user.lgaId) return res.status(403).json({ message: 'Forbidden' });
    // Whitelist fields for LGA
    const allowed = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.email !== undefined) allowed.email = body.email;
    if (body.position !== undefined) allowed.position = body.position;
    const emp = await prisma.employee.update({ where: { id }, data: allowed });
    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'update', entityType: 'employee', entityId: emp.id, entityName: emp.name });
    return res.json(emp);
  }

  const body = adminUpdateSchema.parse(req.body);
  const emp = await prisma.employee.update({ where: { id }, data: body });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'update', entityType: 'employee', entityId: emp.id, entityName: emp.name });
  return res.json(emp);
}

async function remove(req, res) {
  const emp = await prisma.employee.delete({ where: { id: req.params.id } });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'delete', entityType: 'employee', entityId: emp.id, entityName: emp.name });
  res.status(204).end();
}

module.exports = { list, byId, myLga, create, update, remove };
