// Cleanup test users created via invites.
// Usage:
//   node scripts/cleanup-test-users.js --dry
//   node scripts/cleanup-test-users.js --confirm --email-domain example.com
// Options:
//   --dry             Dry run (default). Prints what would be deleted.
//   --confirm         Actually delete.
//   --email-domain d  Only delete users whose email ends with @d
//   --created-after ts  ISO timestamp to delete only users created after ts
//   --exclude email1,email2,...  Comma-separated emails to always exclude
//   --keep-roles r1,r2,...       Comma-separated roles to keep and never delete

const prisma = require('../src/db/prisma');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dry: true, confirm: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry') opts.dry = true;
    else if (a === '--confirm') { opts.confirm = true; opts.dry = false; }
    else if (a === '--email-domain') opts.emailDomain = args[++i];
    else if (a === '--created-after') opts.createdAfter = args[++i];
    else if (a === '--exclude') opts.exclude = args[++i]?.split(',').map(s => s.trim().toLowerCase());
    else if (a === '--keep-roles') opts.keepRoles = args[++i]?.split(',').map(s => s.trim());
  }
  return opts;
}

(async () => {
  const opts = parseArgs();
  try {
    // Build base where: likely test users are status invited or have null acceptedAt
    const where = {
      OR: [
        { status: 'invited' },
        { acceptedAt: null },
      ],
    };

    if (opts.createdAfter) {
      where.createdAt = { gt: new Date(opts.createdAfter) };
    }

    const candidates = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, status: true, acceptedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const excludeSet = new Set((opts.exclude || []).map(e => e.toLowerCase()));
    const keepRoles = new Set(opts.keepRoles || ['SUPER_ADMIN']);

    const filtered = candidates.filter(u => {
      if (!u.email) return false;
      if (excludeSet.has(u.email.toLowerCase())) return false;
      if (keepRoles.has(u.role)) return false;
      if (opts.emailDomain && !u.email.toLowerCase().endsWith('@' + opts.emailDomain.toLowerCase())) return false;
      return true;
    });

    if (!filtered.length) {
      console.log('No users match the cleanup criteria.');
      return;
    }

    console.log('Users matching criteria:');
    console.log(JSON.stringify(filtered, null, 2));

    if (opts.dry) {
      console.log(`Dry run complete. ${filtered.length} users would be deleted.`);
      return;
    }

    if (!opts.confirm) {
      console.log('Add --confirm to actually delete the users.');
      return;
    }

    // Perform deletion
    let deleted = 0;
    for (const u of filtered) {
      await prisma.user.delete({ where: { id: u.id } });
      deleted++;
      console.log(`Deleted: ${u.email}`);
    }
    console.log(`Deleted ${deleted} users.`);
  } catch (e) {
    console.error('Cleanup error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
