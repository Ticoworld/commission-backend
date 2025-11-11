// Seed script to create an initial SUPER admin
const bcrypt = require('bcryptjs');
const prisma = require('../src/db/prisma');
require('dotenv').config();

async function main() {
  // --- Delete old, incorrect roles ---
  console.log('Deleting old roles...');
  try {
    await prisma.role.deleteMany({
      where: {
        name: { in: ['SUPER', 'MEDIA'] },
      },
    });
    console.log('Old roles deleted.');
  } catch (error) {
    console.log('Old roles not found or already deleted.');
  }

  // --- Create default roles ---
  console.log('Seeding default roles...');
  const roles = ['SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN', 'AUDIT', 'LGA'];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  console.log('Default roles seeded.');

  const name = process.env.SEED_SUPER_NAME || 'Super Admin';
  const email = process.env.SEED_SUPER_EMAIL || 'super@eslgsc.gov.ng';
  const password = process.env.SEED_SUPER_PASSWORD || 'ChangeMe123!';

  if (!email || !password) {
    console.error('[seed] Missing SEED_SUPER_EMAIL or SEED_SUPER_PASSWORD');
    process.exit(1);
  }

  // Standardized roles: use SUPER_ADMIN as the top-level role
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 10);
  if (existingUser) {
    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: { name, role: 'SUPER_ADMIN', passwordHash },
    });
    console.log(`[seed] SUPER admin updated: ${updated.email}`);
  } else {
    const created = await prisma.user.create({
      data: { name, email, passwordHash, role: 'SUPER_ADMIN' },
    });
    console.log(`[seed] SUPER admin created: ${created.email}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
