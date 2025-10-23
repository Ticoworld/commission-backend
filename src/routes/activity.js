const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const Activity = require('../controllers/activityController');

const router = express.Router();
router.use(authenticate, requireRole('SUPER', 'ADMIN'));

router.get('/activity-log', (req, res) => Activity.list(req, res));

module.exports = router;