const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');

async function listRoles(req, res) {
  const includeUsage = req.query.includeUsage === '1' || req.query.includeUsage === 'true';
  const roles = await prisma.role.findMany({
    include: { rolePermissions: { include: { permission: true } } },
    orderBy: { name: 'asc' },
  });
  let usageCounts = {};
  if (includeUsage) {
    // Count users per role name
    const byName = await Promise.all(
      roles.map((r) => prisma.user.count({ where: { role: r.name } }))
    );
    roles.forEach((r, idx) => { usageCounts[r.id] = byName[idx]; });
  }
  const data = roles.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.rolePermissions.map((rp) => rp.permission.name),
    ...(includeUsage ? { usageCount: usageCounts[r.id] || 0 } : {}),
  }));
  return res.json({ success: true, data });
}

const createRoleSchema = z.object({ name: z.string().min(2), permissions: z.array(z.string().min(1)).optional() });
const updateRoleSchema = z.object({ name: z.string().min(2).optional(), permissions: z.array(z.string().min(1)).optional() });

async function createRole(req, res) {
  const { name, permissions } = createRoleSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({ where: { name }, update: {}, create: { name } });

    if (permissions && permissions.length) {
      for (const pName of permissions) {
        const perm = await tx.permission.upsert({ where: { name: pName }, update: {}, create: { name: pName } });
        // connect role-permission if not exists
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }

    return role;
  });

  await logActivity({
    actorId: req.user?.id,
    actorName: req.user?.name,
    action: 'CREATE_ROLE',
    entityType: 'Role',
    entityId: result.id,
    entityName: result.name,
    details: { permissions: permissions || [] },
  });

  return res.status(201).json({ success: true, data: { id: result.id, name: result.name, permissions: permissions || [] } });
}

async function updateRole(req, res) {
  const id = req.params.id;
  const { name, permissions } = updateRoleSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.role.findUnique({ where: { id }, include: { rolePermissions: true } });
    if (!existing) return null;

    if (name && name !== existing.name) {
      await tx.role.update({ where: { id }, data: { name } });
    }

    let finalName = name || existing.name;
    let perms = permissions;
    if (Array.isArray(perms)) {
      // Ensure Permission rows exist and compute their IDs
      const permRows = [];
      for (const pName of perms) {
        const perm = await tx.permission.upsert({ where: { name: pName }, update: {}, create: { name: pName } });
        permRows.push(perm);
      }
      const permIds = new Set(permRows.map((p) => p.id));
      // Remove any role-permissions not in new set
      await tx.rolePermission.deleteMany({ where: { roleId: id, NOT: { permissionId: { in: Array.from(permIds) } } } });
      // Add missing role-permissions
      for (const perm of permRows) {
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: id, permissionId: perm.id } },
          update: {},
          create: { roleId: id, permissionId: perm.id },
        });
      }
    }

    const updated = await tx.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return updated ? { id: updated.id, name: updated.name, permissions: updated.rolePermissions.map((rp) => rp.permission.name) } : null;
  });

  if (!result) return res.status(404).json({ message: 'Role not found' });

  await logActivity({
    actorId: req.user?.id,
    actorName: req.user?.name,
    action: 'UPDATE_ROLE',
    entityType: 'Role',
    entityId: result.id,
    entityName: result.name,
    details: { name: result.name, permissions: result.permissions },
  });

  return res.json({ success: true, data: result });
}

async function deleteRole(req, res) {
  const id = req.params.id;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return res.status(404).json({ message: 'Role not found' });

  // Prevent deleting if in use by any user
  const usage = await prisma.user.count({ where: { role: role.name } });
  if (usage > 0) return res.status(400).json({ message: 'Role is in use by users and cannot be deleted' });

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } });
    await tx.role.delete({ where: { id } });
  });

  await logActivity({
    actorId: req.user?.id,
    actorName: req.user?.name,
    action: 'DELETE_ROLE',
    entityType: 'Role',
    entityId: role.id,
    entityName: role.name,
  });

  return res.json({ success: true });
}

module.exports = { listRoles, createRole, updateRole, deleteRole };
