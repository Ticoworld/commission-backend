require('dotenv').config();
const prisma = require('../src/db/prisma');

(async () => {
  try {
    console.log('[test] Attempting prisma.$connect() to', process.env.DATABASE_URL.split('@')[1]);
    await prisma.$connect();
    console.log('[test] Connected successfully');
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[test] Prisma connection error:');
    console.error(err);
    await prisma.$disconnect().catch(()=>{});
    process.exit(1);
  }
})();