const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const Dashboard = require('../controllers/dashboardController');

const router = express.Router();
// Allow MEDIA and AUDIT to fetch notifications as well
router.use(authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MEDIA_ADMIN', 'AUDIT'));

router.get('/dashboard/notifications', (req, res) => Dashboard.notifications(req, res));

module.exports = router;