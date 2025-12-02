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
  const { id } = req.params;
  const { role } = req.user;
  const userLgaId = req.user.lgaId;

  try {
    // 1. Check existence and permissions
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Employee not found' });

    if (role === 'LGA' && existing.lgaId !== userLgaId) {
      return res.status(403).json({ message: 'Unauthorized to update this employee' });
    }

    // 2. Handle File Upload
    let profile_picture_url = undefined;
    if (req.file) {
      // Assuming local upload middleware is used. 
      // If using Cloudinary/S3, adjust to use req.file.path or location
      profile_picture_url = `/uploads/profiles/${req.file.filename}`;
    }

    // 3. Prepare Payload (Convert Strings to Dates)
    const body = { ...req.body };

    // Helper: Convert empty strings or "null" to null, otherwise return value
    const cleanString = (s) => (s === 'null' || s === '' || s === 'undefined' ? null : s);
    
    // Helper: Convert string dates to Date objects
    const parseDate = (d) => {
      if (!d || d === 'null' || d === '') return undefined;
      return new Date(d);
    };

    const payload = {
      full_name: body.full_name,
      sex: body.sex,
      rank: body.rank,
      grade_level: body.grade_level,
      lga_of_origin: body.lga_of_origin,
      department: body.department,
      present_station: body.present_station,
      
      // Clean optional strings
      phone_number: cleanString(body.phone_number),
      qualifications: cleanString(body.qualifications),
      remark: cleanString(body.remark),
      fingerprint_template: cleanString(body.fingerprint_template),
      
      // Parse Dates (CRITICAL FIX)
      date_of_birth: parseDate(body.date_of_birth),
      date_of_first_appointment: parseDate(body.date_of_first_appointment),
      date_of_confirmation: parseDate(body.date_of_confirmation) || null,
      date_of_transfer: parseDate(body.date_of_transfer) || null,
    };

    // Only update profile picture if a new one was uploaded
    if (profile_picture_url) {
      payload.profile_picture_url = profile_picture_url;
    }

    // 4. Execute Update
    const updated = await prisma.employee.update({
      where: { id },
      data: payload,
    });

    await logActivity({ 
      actorId: req.user.id, 
      actorName: req.user.name, 
      action: 'update', 
      entityType: 'employee', 
      entityId: updated.id, 
      entityName: updated.full_name 
    });
    res.json(updated);

  } catch (error) {
    console.error('Error updating employee:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Unique constraint violation' });
    }
    res.status(500).json({ message: 'Error updating employee' });
  }
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
