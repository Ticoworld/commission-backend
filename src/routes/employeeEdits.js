const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const EmployeeEdits = require('../controllers/employeeEditsController');
const validate = require('../middleware/validate');
const { employeeEditsSchema } = require('../schemas/employeeEdits');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('AUDIT', 'SUPER_ADMIN', 'ADMIN'), (req, res) => EmployeeEdits.list(req, res));

router.post('/', requireRole('AUDIT'), validate(employeeEditsSchema), (req, res) => EmployeeEdits.create(req, res));

module.exports = router;