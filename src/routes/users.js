const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { rateLimit, authLimiter } = require('../middleware/rateLimit');
const UsersController = require('../controllers/usersController');

const router = express.Router();

router.get('/', authenticate, requireRole('SUPER_ADMIN'), (req, res) => UsersController.listUsers(req, res));
router.patch('/:id/role', authenticate, requireRole('SUPER_ADMIN'), rateLimit(authLimiter), (req, res) => UsersController.updateUserRole(req, res));
router.post('/:id/force-reset', authenticate, requireRole('SUPER_ADMIN'), rateLimit(authLimiter), (req, res) => UsersController.forceResetPassword(req, res));
router.patch('/:id/status', authenticate, requireRole('SUPER_ADMIN'), rateLimit(authLimiter), (req, res) => UsersController.updateUserStatus(req, res));

module.exports = router;
