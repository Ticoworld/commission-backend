// Seed script to create an initial SUPER admin
const bcrypt = require('bcryptjs');
const prisma = require('../src/db/prisma');
require('dotenv').config();

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowProdSeed = process.env.ALLOW_PROD_SEED === 'true';
  if (isProd && !allowProdSeed) {
    console.error('[seed] Refusing to run in production without ALLOW_PROD_SEED=true');
    process.exit(1);
  }
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

  // --- Create default LGAs ---
  console.log('Seeding default LGAs...');

  const lgaList = [
    'Abakaliki',
    'Ebonyi',
    'Ohaukwu',
    'Ezza North',
    'Ezza South',
    'Ikwo',
    'Ivo',
    'Izzi',
    'Afikpo North',
    'Afikpo South',
    'Onicha',
    'Ohaozara',
    'Ishielu',
  ];

  for (const name of lgaList) {
    // generate a simple unique code from the name (uppercase, underscore-separated)
    const code = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    await prisma.lGA.upsert({
      where: { code },
      update: { name },
      create: { name, code },
    });
  }
  console.log('Default LGAs seeded.');

  const name = process.env.SEED_SUPER_NAME;
  const email = process.env.SEED_SUPER_EMAIL;
  const password = process.env.SEED_SUPER_PASSWORD;

  if (!name || !email || !password) {
    console.error('[seed] Missing SEED_SUPER_NAME, SEED_SUPER_EMAIL or SEED_SUPER_PASSWORD');
    process.exit(1);
  }

  // Standardized roles: use SUPER_ADMIN as the top-level role
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const resetPassword = process.env.SEED_RESET_SUPER_PASSWORD === 'true';
  const passwordHash = await bcrypt.hash(password, 10);
  if (existingUser) {
    const data = { name, role: 'SUPER_ADMIN' };
    if (resetPassword) {
      data.passwordHash = passwordHash;
    }
    const updated = await prisma.user.update({ where: { id: existingUser.id }, data });
    console.log(`[seed] SUPER admin updated: ${updated.email}${resetPassword ? ' (password reset)' : ''}`);
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
