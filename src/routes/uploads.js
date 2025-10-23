const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { upload } = require('../services/uploads');
const Uploads = require('../controllers/uploadsController');

const router = express.Router();

router.post('/', authenticate, requireRole('LGA', 'SUPER', 'ADMIN'), upload.single('file'), (req, res) => Uploads.uploadFile(req, res));

router.get('/my-lga', authenticate, requireRole('LGA'), (req, res) => Uploads.myLga(req, res));

router.get('/all', authenticate, requireRole('SUPER', 'ADMIN'), (req, res) => Uploads.all(req, res));

// Protected download route: streams file content and enforces authentication/authorization
router.get('/:filename', authenticate, (req, res) => Uploads.downloadFile(req, res));

module.exports = router;