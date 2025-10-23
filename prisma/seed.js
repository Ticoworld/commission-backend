// Seed script to create an initial SUPER admin
const bcrypt = require('bcryptjs');
const prisma = require('../src/db/prisma');
require('dotenv').config();

async function main() {
  const name = process.env.SEED_SUPER_NAME || 'Super Admin';
  const email = process.env.SEED_SUPER_EMAIL || 'super@eslgsc.gov.ng';
  const password = process.env.SEED_SUPER_PASSWORD || 'ChangeMe123!';

  if (!email || !password) {
    console.error('[seed] Missing SEED_SUPER_EMAIL or SEED_SUPER_PASSWORD');
    process.exit(1);
  }

  const existingSuper = await prisma.user.findFirst({ where: { role: 'SUPER' } });
  if (existingSuper) {
    console.log(`[seed] SUPER admin already exists: ${existingSuper.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role: 'SUPER' },
  });
  console.log(`[seed] Created SUPER admin: ${user.email}`);
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
