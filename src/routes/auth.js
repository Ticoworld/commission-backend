const express = require('express');
const validate = require('../middleware/validate');
const { rateLimit, authLimiter } = require('../middleware/rateLimit');
const { authenticate, requireRole } = require('../middleware/auth');
const AuthController = require('../controllers/authController');
const InvitesController = require('../controllers/invitesController');

const router = express.Router();

router.post('/login', rateLimit(authLimiter), (req, res) => AuthController.login(req, res));

// Current user
router.get('/me', authenticate, (req, res) => AuthController.me(req, res));

// Invite a user (SUPER only)
router.post('/invite', authenticate, requireRole('SUPER'), rateLimit(authLimiter), (req, res) => AuthController.invite(req, res));

// Accept invite / set password
router.post('/set-password', (req, res) => AuthController.setPassword(req, res));
// Optional redirect for GET to SPA route
router.get('/set-password', (req, res) => {
	const token = req.query.token;
	if (!token) return res.status(400).json({ message: 'Token required' });
	const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
	return res.redirect(302, `${baseUrl}/set-password?token=${encodeURIComponent(token)}`);
});

// Admin-initiated reset password
router.post('/reset-password', (req, res) => AuthController.resetPassword(req, res));
// Optional redirect for GET to SPA route
router.get('/reset-password', (req, res) => {
	const token = req.query.token;
	if (!token) return res.status(400).json({ message: 'Token required' });
	const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
	return res.redirect(302, `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`);
});

// Invites management
router.get('/invites', authenticate, requireRole('SUPER'), (req, res) => InvitesController.listInvites(req, res));
router.post('/invites/:id/resend', authenticate, requireRole('SUPER'), rateLimit(authLimiter), (req, res) => InvitesController.resendInvite(req, res));
router.delete('/invites/:id', authenticate, requireRole('SUPER'), rateLimit(authLimiter), (req, res) => InvitesController.revokeInvite(req, res));
router.post('/invites/:id/revoke', authenticate, requireRole('SUPER'), rateLimit(authLimiter), (req, res) => InvitesController.revokeInvite(req, res));

module.exports = router;