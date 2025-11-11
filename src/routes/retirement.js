const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const Retirement = require('../controllers/retirementController');

const router = express.Router();
router.use(authenticate, requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/retirement-alerts', (req, res) => Retirement.list(req, res));

router.post('/retirement-alerts/export', (req, res) => Retirement.exportReport(req, res));

module.exports = router;