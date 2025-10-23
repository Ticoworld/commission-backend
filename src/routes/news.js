const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const News = require('../controllers/newsController');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('MEDIA', 'SUPER', 'ADMIN'), (req, res) => News.list(req, res));

router.get('/:id', requireRole('MEDIA', 'SUPER', 'ADMIN'), (req, res) => News.get(req, res));

router.post('/', requireRole('MEDIA'), (req, res) => News.create(req, res));
router.put('/:id', requireRole('MEDIA'), (req, res) => News.update(req, res));
router.post('/:id/submit', requireRole('MEDIA'), (req, res) => News.submit(req, res));
router.post('/:id/approve', requireRole('SUPER', 'ADMIN'), (req, res) => News.approve(req, res));
router.post('/:id/reject', requireRole('SUPER', 'ADMIN'), (req, res) => News.reject(req, res));

module.exports = router;