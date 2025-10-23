const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const AuditQueue = require('../controllers/auditQueueController');

const router = express.Router();
router.use(authenticate, requireRole('SUPER', 'ADMIN'));

router.get('/', (req, res) => AuditQueue.list(req, res));

router.post('/:id/approve', (req, res) => AuditQueue.approve(req, res));
router.post('/:id/reject', (req, res) => AuditQueue.reject(req, res));

module.exports = router;