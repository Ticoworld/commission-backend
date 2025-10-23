const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const EmployeeEdits = require('../controllers/employeeEditsController');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('AUDIT', 'SUPER', 'ADMIN'), (req, res) => EmployeeEdits.list(req, res));

router.post('/', requireRole('AUDIT'), (req, res) => EmployeeEdits.create(req, res));

module.exports = router;