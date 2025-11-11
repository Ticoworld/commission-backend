const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadProfilePicture } = require('../middleware/uploadMiddleware');
const Employees = require('../controllers/employeesController');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('SUPER_ADMIN', 'ADMIN', 'AUDIT'), (req, res) => Employees.list(req, res));
router.get('/my-lga', requireRole('LGA'), (req, res) => Employees.myLga(req, res));
router.get('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'AUDIT'), (req, res) => Employees.byId(req, res));
// Allow LGA to create/update within their scope; controller enforces whitelist/ownership
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'LGA'), uploadProfilePicture.single('profile_picture'), (req, res) => Employees.create(req, res));
router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'LGA'), (req, res) => Employees.update(req, res));
router.delete('/:id', requireRole('SUPER_ADMIN'), (req, res) => Employees.remove(req, res));

module.exports = router;