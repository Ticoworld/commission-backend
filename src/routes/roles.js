const express = require('express');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const RolesController = require('../controllers/rolesController');
const { rateLimit, authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/', authenticate, requireRole('SUPER_ADMIN'), (req, res) => RolesController.listRoles(req, res));
router.post('/', authenticate, requireRole('SUPER_ADMIN'), rateLimit(authLimiter), (req, res) => RolesController.createRole(req, res));
router.patch('/:id', authenticate, requireRole('SUPER_ADMIN'), rateLimit(authLimiter), (req, res) => RolesController.updateRole(req, res));
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), rateLimit(authLimiter), (req, res) => RolesController.deleteRole(req, res));

module.exports = router;
