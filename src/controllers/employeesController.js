const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

// Admin can manage all fields; LGA has a minimal subset
const adminCreateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  rank: z.string().min(1, 'Rank is required'),
  grade_level: z.string().min(1, 'Grade level is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'), // Will be converted to Date
  date_of_first_appointment: z.string().min(1, 'Date of first appointment is required'), // Will be converted to Date
  lga_of_origin: z.string().min(1, 'LGA of origin is required'),
  department: z.string().min(1, 'Department is required'),
  present_station: z.string().min(1, 'Present station is required'),
  phone_number: z.string().optional(),
  qualifications: z.string().optional(),
  date_of_confirmation: z.string().optional(), // Will be converted to Date if provided
  date_of_transfer: z.string().optional(), // Will be converted to Date if provided
  remark: z.string().optional(),
  fingerprint_template: z.string().optional(),
  lgaId: z.string().uuid().optional(),
});

const lgaCreateSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  sex: z.string().min(1, 'Sex is required'),
  rank: z.string().min(1, 'Rank is required'),
  grade_level: z.string().min(1, 'Grade level is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  date_of_first_appointment: z.string().min(1, 'Date of first appointment is required'),
  lga_of_origin: z.string().min(1, 'LGA of origin is required'),
  department: z.string().min(1, 'Department is required'),
  present_station: z.string().min(1, 'Present station is required'),
  phone_number: z.string().optional(),
  qualifications: z.string().optional(),
  date_of_confirmation: z.string().optional(),
  date_of_transfer: z.string().optional(),
  remark: z.string().optional(),
  fingerprint_template: z.string().optional(),
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
    ...(searchTerm ? { OR: [ { full_name: { contains: searchTerm, mode: 'insensitive' } }, { phone_number: { contains: searchTerm, mode: 'insensitive' } } ] } : {}),
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
  // Extract profile picture URL if file was uploaded
  let profile_picture_url = null;
  if (req.file) {
    // Store the relative URL path for public access
    profile_picture_url = `/uploads/profiles/${req.file.filename}`;
  }

  if (req.user.role === 'LGA') {
    const body = lgaCreateSchema.parse(req.body);
    
    // Convert date strings to Date objects
    const date_of_birth = new Date(body.date_of_birth);
    const date_of_first_appointment = new Date(body.date_of_first_appointment);
    const date_of_confirmation = body.date_of_confirmation ? new Date(body.date_of_confirmation) : null;
    const date_of_transfer = body.date_of_transfer ? new Date(body.date_of_transfer) : null;

    const emp = await prisma.employee.create({
      data: { 
        full_name: body.full_name,
        sex: body.sex,
        rank: body.rank,
        grade_level: body.grade_level,
        date_of_birth,
        date_of_first_appointment,
        lga_of_origin: body.lga_of_origin,
        department: body.department,
        present_station: body.present_station,
        phone_number: body.phone_number || null,
        qualifications: body.qualifications || null,
        date_of_confirmation,
        date_of_transfer,
        remark: body.remark || null,
        fingerprint_template: body.fingerprint_template || null,
        profile_picture_url,
        lgaId: req.user.lgaId,
      },
    });
    await logActivity({ 
      actorId: req.user.id, 
      actorName: req.user.name, 
      action: 'create', 
      entityType: 'employee', 
      entityId: emp.id, 
      entityName: emp.full_name 
    });
    return res.status(201).json(emp);
  }

  // Admin role
  const body = adminCreateSchema.parse(req.body);
  
  // Convert date strings to Date objects
  const date_of_birth = new Date(body.date_of_birth);
  const date_of_first_appointment = new Date(body.date_of_first_appointment);
  const date_of_confirmation = body.date_of_confirmation ? new Date(body.date_of_confirmation) : null;
  const date_of_transfer = body.date_of_transfer ? new Date(body.date_of_transfer) : null;

  const emp = await prisma.employee.create({ 
    data: { 
      full_name: body.full_name,
      sex: body.sex,
      rank: body.rank,
      grade_level: body.grade_level,
      date_of_birth,
      date_of_first_appointment,
      lga_of_origin: body.lga_of_origin,
      department: body.department,
      present_station: body.present_station,
      phone_number: body.phone_number || null,
      qualifications: body.qualifications || null,
      date_of_confirmation,
      date_of_transfer,
      remark: body.remark || null,
      fingerprint_template: body.fingerprint_template || null,
      profile_picture_url,
      lgaId: body.lgaId || null,
    } 
  });
  await logActivity({ 
    actorId: req.user.id, 
    actorName: req.user.name, 
    action: 'create', 
    entityType: 'employee', 
    entityId: emp.id, 
    entityName: emp.full_name 
  });
  return res.status(201).json(emp);
}

async function update(req, res) {
  const id = req.params.id;
  if (req.user.role === 'LGA') {
    const body = lgaUpdateSchema.parse(req.body);
    // Ensure ownership by LGA
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.lgaId !== req.user.lgaId) return res.status(403).json({ message: 'Forbidden' });
    
    // Whitelist fields for LGA and convert dates
    const allowed = {};
    if (body.full_name !== undefined) allowed.full_name = body.full_name;
    if (body.sex !== undefined) allowed.sex = body.sex;
    if (body.rank !== undefined) allowed.rank = body.rank;
    if (body.grade_level !== undefined) allowed.grade_level = body.grade_level;
    if (body.date_of_birth !== undefined) allowed.date_of_birth = new Date(body.date_of_birth);
    if (body.date_of_first_appointment !== undefined) allowed.date_of_first_appointment = new Date(body.date_of_first_appointment);
    if (body.lga_of_origin !== undefined) allowed.lga_of_origin = body.lga_of_origin;
    if (body.department !== undefined) allowed.department = body.department;
    if (body.present_station !== undefined) allowed.present_station = body.present_station;
    if (body.phone_number !== undefined) allowed.phone_number = body.phone_number;
    if (body.qualifications !== undefined) allowed.qualifications = body.qualifications;
    if (body.date_of_confirmation !== undefined) allowed.date_of_confirmation = body.date_of_confirmation ? new Date(body.date_of_confirmation) : null;
    if (body.date_of_transfer !== undefined) allowed.date_of_transfer = body.date_of_transfer ? new Date(body.date_of_transfer) : null;
    if (body.remark !== undefined) allowed.remark = body.remark;
    if (body.fingerprint_template !== undefined) allowed.fingerprint_template = body.fingerprint_template;
    
    const emp = await prisma.employee.update({ where: { id }, data: allowed });
    await logActivity({ 
      actorId: req.user.id, 
      actorName: req.user.name, 
      action: 'update', 
      entityType: 'employee', 
      entityId: emp.id, 
      entityName: emp.full_name 
    });
    return res.json(emp);
  }

  // Admin role
  const body = adminUpdateSchema.parse(req.body);
  
  // Convert date strings to Date objects if provided
  const updateData = { ...body };
  if (body.date_of_birth) updateData.date_of_birth = new Date(body.date_of_birth);
  if (body.date_of_first_appointment) updateData.date_of_first_appointment = new Date(body.date_of_first_appointment);
  if (body.date_of_confirmation) updateData.date_of_confirmation = new Date(body.date_of_confirmation);
  if (body.date_of_transfer) updateData.date_of_transfer = new Date(body.date_of_transfer);
  
  const emp = await prisma.employee.update({ where: { id }, data: updateData });
  await logActivity({ 
    actorId: req.user.id, 
    actorName: req.user.name, 
    action: 'update', 
    entityType: 'employee', 
    entityId: emp.id, 
    entityName: emp.full_name 
  });
  return res.json(emp);
}

async function remove(req, res) {
  const emp = await prisma.employee.delete({ where: { id: req.params.id } });
  await logActivity({ 
    actorId: req.user.id, 
    actorName: req.user.name, 
    action: 'delete', 
    entityType: 'employee', 
    entityId: emp.id, 
    entityName: emp.full_name 
  });
  res.status(204).end();
}

module.exports = { list, byId, myLga, create, update, remove };
