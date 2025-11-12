// Backfill slug values for News where slug is NULL or empty
// Usage:
//   node scripts/backfill-news-slugs.js --dry
//   node scripts/backfill-news-slugs.js --confirm
// Options:
//   --limit N    process at most N records (for testing)

const prisma = require('../src/db/prisma');
const slugify = require('slugify');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dry: true, limit: undefined };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry') opts.dry = true;
    else if (a === '--confirm') { opts.dry = false; }
    else if (a === '--limit') opts.limit = Number(args[++i]);
  }
  return opts;
}

(async () => {
  const opts = parseArgs();
  try {
    // Get all news items and existing slugs
    const whereMissing = { OR: [{ slug: null }, { slug: '' }] };
    // Fetch sequentially to minimize concurrent connections
    const allExisting = await prisma.news.findMany({ select: { slug: true } });
    const toBackfill = await prisma.news.findMany({ where: whereMissing, select: { id: true, title: true, slug: true }, orderBy: { createdAt: 'asc' } });

    let items = toBackfill;
    if (opts.limit && Number.isFinite(opts.limit)) {
      items = items.slice(0, opts.limit);
    }

    const used = new Set((allExisting.map(x => x.slug).filter(Boolean)).map(s => s.toLowerCase()));

    const plans = items.map((it) => {
      const base = slugify(it.title || '', { lower: true, strict: true }) || `post-${it.id.slice(-6)}`;
      let candidate = base;
      let attempt = 0;
      while (used.has(candidate.toLowerCase())) {
        attempt += 1;
        const suffix = String(Date.now()).slice(-5) + (attempt > 1 ? `-${attempt}` : '');
        candidate = `${base}-${suffix}`;
      }
      used.add(candidate.toLowerCase());
      return { id: it.id, from: it.slug, to: candidate, title: it.title };
    });

    if (!plans.length) {
      console.log('No News rows require backfilling.');
      return;
    }

    console.log('Planned slug updates:');
    console.log(JSON.stringify(plans, null, 2));

    if (opts.dry) {
      console.log(`Dry run complete. ${plans.length} rows would be updated.`);
      return;
    }

    // Apply updates sequentially to avoid unique conflicts
    for (const p of plans) {
      await prisma.news.update({ where: { id: p.id }, data: { slug: p.to } });
      console.log(`Updated ${p.id} -> ${p.to}`);
    }
    console.log(`Updated ${plans.length} rows.`);
  } catch (e) {
    console.error('Backfill error:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
