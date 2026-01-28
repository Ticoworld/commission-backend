const { z } = require('zod');
const prisma = require('../db/prisma');
const { logActivity } = require('../utils/activity');
const slugify = require('slugify');

const newsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  // Accept imageUrl as string (URL validation is lenient to allow Cloudinary URLs)
  imageUrl: z.string().optional().or(z.literal('')),
  // Accept either comma-separated string or array of strings
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});

function normalizeTags(tags) {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') return tags.split(',').map((s) => s.trim()).filter(Boolean);
  return undefined;
}

async function list(req, res) {
  const { status, authorId } = req.query;
  const where = { ...(status ? { status } : {}), ...(authorId ? { authorId } : {}) };
  const items = await prisma.news.findMany({ where, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } });
  const shaped = items.map(({ author, ...rest }) => ({
    ...rest,
    authorName: author?.name || null,
    // Expose a submittedAt hint without schema change: when status becomes pending, updatedAt is the submit time
    submittedAt: rest.status === 'pending' ? rest.updatedAt : null,
  }));
  res.json(shaped);
}

async function get(req, res) {
  const item = await prisma.news.findUnique({ where: { id: req.params.id }, include: { author: { select: { name: true } } } });
  if (!item) return res.status(404).json({ message: 'News not found' });
  const { author, ...rest } = item;
  res.json({
    ...rest,
    authorName: author?.name || null,
    submittedAt: rest.status === 'pending' ? rest.updatedAt : null,
  });
}

// Public: fetch a published post by slug
async function getNewsBySlug(req, res) {
  const { slug } = req.params;
  try {
    const post = await prisma.news.findUnique({
      where: { slug },
      include: { author: { select: { name: true } } },
    });
    if (!post || post.status !== 'published') {
      return res.status(404).json({ message: 'News post not found or not published' });
    }
    const { author, ...rest } = post;
    return res.status(200).json({ ...rest, authorName: author?.name || null });
  } catch (error) {
    console.error('Error fetching news by slug:', error);
    return res.status(500).json({ message: 'Error fetching news post' });
  }
}

// Public: fetch a published post by ID (fallback when slug doesn't exist)
async function getPublishedById(req, res) {
  const { id } = req.params;
  
  // Validate UUID format before querying
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(404).json({ message: 'News post not found' });
  }
  
  try {
    const post = await prisma.news.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });
    if (!post || post.status !== 'published') {
      return res.status(404).json({ message: 'News post not found or not published' });
    }
    const { author, ...rest } = post;
    return res.status(200).json({ ...rest, authorName: author?.name || null });
  } catch (error) {
    console.error('Error fetching news by ID:', error);
    return res.status(500).json({ message: 'Error fetching news post' });
  }
}

async function create(req, res) {
  const parsed = newsSchema.parse(req.body);
  
  // Only pass fields that exist in the DB. Production may not have slug column yet.
  const data = {
    title: parsed.title,
    summary: parsed.summary,
    content: parsed.content,
    category: parsed.category,
    imageUrl: parsed.imageUrl,
    tags: normalizeTags(parsed.tags),
    status: 'draft',
    authorId: req.user.id,
  };
  
  const item = await prisma.news.create({ data });
  res.status(201).json(item);
}

async function update(req, res) {
  const id = req.params.id;
  const data = newsSchema.partial().parse(req.body);
  // Only pass fields that exist in the DB (no slug - production may not have column yet)
  const payload = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.summary !== undefined && { summary: data.summary }),
    ...(data.content !== undefined && { content: data.content }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    ...(data.tags !== undefined && { tags: normalizeTags(data.tags) }),
    ...(data.status !== undefined && { status: data.status }),
  };
  const item = await prisma.news.update({ where: { id }, data: payload });
  res.json(item);
}

async function submit(req, res) {
  const id = req.params.id;
  const userRole = req.user.role;
  
  // SUPER_ADMIN and ADMIN can auto-approve their own submissions
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
    const item = await prisma.news.update({ 
      where: { id }, 
      data: { 
        status: 'published', 
        publishedAt: new Date(), 
        rejectionNotes: null 
      } 
    });
    await logActivity({ 
      actorId: req.user.id, 
      actorName: req.user.name, 
      action: 'publish', 
      entityType: 'news', 
      entityId: id, 
      entityName: item.title,
      details: { autoApproved: true }
    });
    return res.json({ message: 'Article published successfully' });
  }
  
  // MEDIA_ADMIN submits for approval
  const item = await prisma.news.update({ where: { id }, data: { status: 'pending', rejectionNotes: null } });
  await prisma.auditQueue.upsert({
    where: { id },
    update: { entityType: 'news', entityId: id, status: 'pending', entityName: item.title, submittedById: req.user.id, submittedByName: req.user.name },
    create: { id, entityType: 'news', entityId: id, status: 'pending', entityName: item.title, submittedById: req.user.id, submittedByName: req.user.name },
  });
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'submit', entityType: 'news', entityId: id, entityName: item.title });
  res.json({ message: 'Submitted for approval' });
}

async function approve(req, res) {
  const id = req.params.id;
  const item = await prisma.news.update({ where: { id }, data: { status: 'published', publishedAt: new Date() } });
  await prisma.auditQueue.delete({ where: { id } }).catch(() => {});
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'approve', entityType: 'news', entityId: id, entityName: item.title });
  res.json({ message: 'Approved and published' });
}

async function reject(req, res) {
  const id = req.params.id;
  const item = await prisma.news.update({ where: { id }, data: { status: 'draft' } });
  await prisma.auditQueue.delete({ where: { id } }).catch(() => {});
  await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'reject', entityType: 'news', entityId: id, entityName: item.title });
  res.json({ message: 'Rejected' });
}

async function deletePost(req, res) {
  const { id } = req.params;
  try {
    const post = await prisma.news.findUnique({ where: { id } });
    const title = post ? post.title : `ID ${id}`;

    if (!post) {
      return res.status(404).json({ message: 'News post not found' });
    }

    await prisma.news.delete({ where: { id } });

    await logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'delete', entityType: 'news', entityId: id, entityName: title });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting news post:', error);
    res.status(500).json({ message: 'Error deleting news post' });
  }
}

// Admin-only: backfill slugs via API (use with care). Optional ?dry=true
async function backfillSlugs(req, res) {
  const dry = String(req.query.dry || '').toLowerCase() === 'true';
  try {
    const whereMissing = { OR: [{ slug: null }, { slug: '' }] };
    const allExisting = await prisma.news.findMany({ select: { slug: true } });
    const toBackfill = await prisma.news.findMany({ where: whereMissing, select: { id: true, title: true, slug: true }, orderBy: { createdAt: 'asc' } });

    const used = new Set((allExisting.map((x) => x.slug).filter(Boolean)).map((s) => s.toLowerCase()));
    const plans = toBackfill.map((it) => {
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

    if (dry) {
      return res.json({ dryRun: true, updates: plans, count: plans.length });
    }

    for (const p of plans) {
      await prisma.news.update({ where: { id: p.id }, data: { slug: p.to } });
    }
    return res.json({ dryRun: false, updated: plans.length });
  } catch (e) {
    console.error('Error backfilling slugs via API:', e);
    return res.status(500).json({ message: 'Error backfilling slugs' });
  }
}

module.exports = { list, get, getNewsBySlug, getPublishedById, create, update, submit, approve, reject, deletePost, backfillSlugs };
