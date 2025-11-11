const express = require('express');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const Announcements = require('../controllers/announcementsController');

const router = express.Router();

router.get('/', (req, res) => Announcements.list(req, res));

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'ADMIN'), (req, res) => Announcements.create(req, res));

module.exports = router;