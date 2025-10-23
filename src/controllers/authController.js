const { z } = require('zod');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const env = require('../config/env');
const { sendMail } = require('../services/mail');
const { logActivity } = require('../utils/activity');

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role, lgaId: user.lgaId, name: user.name }, env.JWT_SECRET, { algorithm: 'HS256' });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, lgaId: user.lgaId || undefined } });
}
const inviteSchema = z.object({ email: z.string().email(), role: z.string().min(2) });

async function invite(req, res) {
  // Only SUPER role should reach here via middleware
  const { email, role } = inviteSchema.parse(req.body);

  // Short random token and 24h expiry
  const token = crypto.randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Ensure a Role row exists for discoverability (optional for current RBAC)
  await prisma.role.upsert({
    where: { name: role },
    update: {},
    create: { name: role },
  });

  // Upsert user or update existing invite
  const existing = await prisma.user.findUnique({ where: { email } });
  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role,
        inviteToken: token,
        inviteTokenExpires: expiresAt,
        status: existing.status === 'active' ? 'active' : 'invited',
      },
    });
  } else {
    const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const fallbackName = email.split('@')[0];
    user = await prisma.user.create({
      data: {
        name: fallbackName,
        email,
        passwordHash: randomPasswordHash,
        role,
        status: 'invited',
        inviteToken: token,
        inviteTokenExpires: expiresAt,
      },
    });
  }

  // Build absolute URL for set-password
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  // Point invite link to SPA route, not API
  const link = `${baseUrl}/set-password?token=${token}`;

  const subject = 'You are invited to ESLGSC Admin Portal';
  const text = `Hello,
You have been invited to the ESLGSC admin portal with role: ${role}.
Please set your password using the one-time link below (valid for 24 hours):
${link}

If you did not expect this email, you can ignore it.`;

  await sendMail({ to: email, subject, text });

  await logActivity({
    actorId: req.user?.id,
    actorName: req.user?.name,
    action: 'INVITE_USER',
    entityType: 'User',
    entityId: user.id,
    entityName: user.email,
    details: { email, role },
  });

  return res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role, status: user.status } });
}

const setPasswordSchema = z.object({ token: z.string().min(8), password: z.string().min(6) });

async function setPassword(req, res) {
  const { token, password } = setPasswordSchema.parse(req.body);
  const now = new Date();
  const user = await prisma.user.findFirst({ where: { inviteToken: token, inviteTokenExpires: { gt: now } } });
  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, status: 'active', acceptedAt: new Date(), inviteToken: null, inviteTokenExpires: null },
  });

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: 'SET_PASSWORD',
    entityType: 'User',
    entityId: user.id,
    entityName: user.email,
  });

  return res.json({ success: true });
}

async function me(req, res) {
  // req.user is set by auth middleware
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, role: true, status: true } });
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  // Lookup permissions for the user's role from Role/Permission tables
  const roleRow = await prisma.role.findUnique({ where: { name: user.role }, include: { rolePermissions: { include: { permission: true } } } });
  const permissions = roleRow ? roleRow.rolePermissions.map((rp) => rp.permission.name) : [];
  return res.json({ user, roles: [user.role], permissions });
}

const resetPasswordSchema = z.object({ token: z.string().min(8), password: z.string().min(6) });

async function resetPassword(req, res) {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const now = new Date();
  const user = await prisma.user.findFirst({ where: { resetToken: token, resetTokenExpires: { gt: now } } });
  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, resetToken: null, resetTokenExpires: null } });

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    action: 'RESET_PASSWORD',
    entityType: 'User',
    entityId: user.id,
    entityName: user.email,
  });

  return res.json({ success: true });
}

module.exports = { login, invite, setPassword, me, resetPassword };
