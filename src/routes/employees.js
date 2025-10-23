const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const Employees = require('../controllers/employeesController');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('SUPER', 'ADMIN', 'AUDIT'), (req, res) => Employees.list(req, res));
router.get('/my-lga', requireRole('LGA'), (req, res) => Employees.myLga(req, res));
router.get('/:id', requireRole('SUPER', 'ADMIN', 'AUDIT'), (req, res) => Employees.byId(req, res));
// Allow LGA to create/update within their scope; controller enforces whitelist/ownership
router.post('/', requireRole('SUPER', 'ADMIN', 'LGA'), (req, res) => Employees.create(req, res));
router.put('/:id', requireRole('SUPER', 'ADMIN', 'LGA'), (req, res) => Employees.update(req, res));
router.delete('/:id', requireRole('SUPER'), (req, res) => Employees.remove(req, res));

module.exports = router;