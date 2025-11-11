const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const LGAs = require('../controllers/lgasController');

const router = express.Router();
router.use(authenticate, requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/', (req, res) => LGAs.list(req, res));
router.post('/', (req, res) => LGAs.create(req, res));
router.put('/:id', (req, res) => LGAs.update(req, res));

module.exports = router;