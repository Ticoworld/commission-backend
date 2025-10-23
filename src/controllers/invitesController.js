const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { sendMail } = require('../services/mail');
const { logActivity } = require('../utils/activity');

const listSchema = z.object({
  status: z.enum(['pending', 'expired', 'accepted', 'all']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

async function listInvites(req, res) {
  const { status = 'pending', q = '', page = 1, pageSize = 20 } = listSchema.parse(req.query);
  const now = new Date();
  const whereBase = {};
  const whereStatus = (() => {
    if (status === 'pending') return { status: 'invited', inviteToken: { not: null }, inviteTokenExpires: { gt: now } };
    if (status === 'expired') return { status: 'invited', inviteToken: { not: null }, inviteTokenExpires: { lte: now } };
    if (status === 'accepted') return { status: 'active', acceptedAt: { not: null } };
    return {};
  })();
  const where = {
    AND: [whereBase, whereStatus, q ? { email: { contains: q, mode: 'insensitive' } } : {}],
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        inviteToken: true,
        inviteTokenExpires: true,
        acceptedAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return res.json({ data: items, meta: { total, page, pageSize } });
}

const idParamSchema = z.object({ id: z.string().uuid().or(z.string()) });

async function resendInvite(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const token = crypto.randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { inviteToken: token, inviteTokenExpires: expiresAt, status: 'invited' },
    select: { id: true, email: true, inviteToken: true, inviteTokenExpires: true, status: true },
  });

  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  // Use SPA route for set password
  const link = `${baseUrl}/set-password?token=${token}`;
  await sendMail({ to: updated.email, subject: 'Your ESLGSC Invite', text: `Set your password: ${link}` });

  await logActivity({
    actorId: req.user?.id,
    actorName: req.user?.name,
    action: 'RESEND_INVITE',
    entityType: 'User',
    entityId: updated.id,
    entityName: updated.email,
  });

  return res.json({ success: true });
}

async function revokeInvite(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { inviteToken: null, inviteTokenExpires: null, status: 'disabled' },
    select: { id: true, email: true, inviteToken: true, inviteTokenExpires: true, status: true },
  });

  await logActivity({
    actorId: req.user?.id,
    actorName: req.user?.name,
    action: 'REVOKE_INVITE',
    entityType: 'User',
    entityId: updated.id,
    entityName: updated.email,
  });

  return res.json({ success: true, data: updated });
}

module.exports = { listInvites, resendInvite, revokeInvite };
