const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const News = require('../controllers/newsController');

const router = express.Router();

// PUBLIC ROUTE: Get a single post by its slug
router.get('/slug/:slug', (req, res) => News.getNewsBySlug(req, res));

router.use(authenticate);

router.get('/', requireRole('MEDIA_ADMIN', 'SUPER_ADMIN', 'ADMIN'), (req, res) => News.list(req, res));

router.get('/:id', requireRole('MEDIA_ADMIN', 'SUPER_ADMIN', 'ADMIN'), (req, res) => News.get(req, res));

// Creation and update restricted to MEDIA_ADMIN per updated RBAC
router.post('/', requireRole('MEDIA_ADMIN'), (req, res) => News.create(req, res));
router.put('/:id', requireRole('MEDIA_ADMIN'), (req, res) => News.update(req, res));
router.post('/:id/submit', requireRole('MEDIA_ADMIN'), (req, res) => News.submit(req, res));
router.post('/:id/approve', requireRole('SUPER_ADMIN', 'ADMIN'), (req, res) => News.approve(req, res));
router.post('/:id/reject', requireRole('SUPER_ADMIN', 'ADMIN'), (req, res) => News.reject(req, res));

// Delete a news post (SUPER_ADMIN or ADMIN)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), (req, res) => News.deletePost(req, res));

// Admin-only: backfill slugs for existing records (optionally ?dry=true)
router.post('/backfill-slugs', requireRole('SUPER_ADMIN'), (req, res) => News.backfillSlugs(req, res));

module.exports = router;