// List users for audit/cleanup
const prisma = require('../src/db/prisma');

(async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        acceptedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Error listing users:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
