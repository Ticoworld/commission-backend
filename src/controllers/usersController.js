const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { sendMail } = require('../services/mail');
const { logActivity } = require('../utils/activity');

const listSchema = z.object({
  q: z.string().optional(),
  // Accept empty string from query (treat as undefined)
  role: z.preprocess((val) => (val === '' ? undefined : val), z.enum(['SUPER_ADMIN','ADMIN','MEDIA_ADMIN','AUDIT','LGA']).optional()),
  status: z.enum(['active','invited','disabled','all']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

async function listUsers(req, res) {
  const { q = '', role, status = 'all', page = 1, pageSize = 20 } = listSchema.parse(req.query);
  const where = {
    AND: [
      q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {},
      role ? { role } : {},
      status === 'all' ? {} : { status },
    ],
  };
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return res.json({ data: items, meta: { total, page, pageSize } });
}

const roleSchema = z.object({ role: z.enum(['SUPER_ADMIN','ADMIN','MEDIA_ADMIN','AUDIT']) });
const idParams = z.object({ id: z.string() });

async function updateUserRole(req, res) {
  const { id } = idParams.parse(req.params);
  const { role } = roleSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, name: true, email: true, role: true, status: true } });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'UPDATE_USER_ROLE', entityType: 'User', entityId: user.id, entityName: user.email, details: { role } });
  return res.json({ success: true, data: user });
}

async function forceResetPassword(req, res) {
  const { id } = idParams.parse(req.params);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetTokenExpires: expiresAt } });
  const env = require('../config/env');
  const baseUrl = env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  // Use SPA route for reset password
  const link = `${baseUrl}/reset-password?token=${token}`;
  await sendMail({ to: user.email, subject: 'Password reset', text: `Reset your password: ${link}` });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'FORCE_RESET_PASSWORD', entityType: 'User', entityId: user.id, entityName: user.email });
  return res.json({ success: true });
}

const statusSchema = z.object({ active: z.boolean() });

async function updateUserStatus(req, res) {
  const { id } = idParams.parse(req.params);
  const { active } = statusSchema.parse(req.body);
  const status = active ? 'active' : 'disabled';
  const user = await prisma.user.update({ where: { id }, data: { status }, select: { id: true, name: true, email: true, role: true, status: true } });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'UPDATE_USER_STATUS', entityType: 'User', entityId: user.id, entityName: user.email, details: { status } });
  return res.json({ success: true, data: user });
}

module.exports = { listUsers, updateUserRole, forceResetPassword, updateUserStatus };
