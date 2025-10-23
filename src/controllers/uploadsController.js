const prisma = require('../db/prisma');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

async function uploadFile(req, res) {
  const { title, lgaId: lgaIdBody } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'File is required' });
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
  const lgaId = req.user.role === 'LGA' ? req.user.lgaId : (lgaIdBody || null);
  if (!lgaId) return res.status(400).json({ message: 'lgaId required for non-LGA users' });
  const rec = await prisma.upload.create({ data: { title, filename: file.filename, fileUrl, lgaId } });
  res.status(201).json(rec);
}

async function myLga(req, res) {
  const items = await prisma.upload.findMany({ where: { lgaId: req.user.lgaId }, orderBy: { createdAt: 'desc' } });
  res.json(items);
}

async function all(req, res) {
  const items = await prisma.upload.findMany({ orderBy: { createdAt: 'desc' }, include: { lga: { select: { name: true } } } });
  const shaped = items.map(({ lga, ...rest }) => ({ ...rest, lga: lga ? { name: lga.name } : null }));
  res.json(shaped);
}

async function downloadFile(req, res) {
  const filename = req.params.filename;
  // Basic validation: filename should be a UUID + ext or at least no path traversal
  if (!filename || filename.includes('..') || filename.includes('/')) return res.status(400).json({ message: 'Invalid filename' });

  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const filePath = path.join(uploadDir, filename);
  if (!filePath.startsWith(uploadDir)) return res.status(400).json({ message: 'Invalid filename' });

  try {
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });

    // Optionally enforce permission: ensure that non-super users can only access their LGA files
    const uploadRec = await prisma.upload.findUnique({ where: { filename } });
    if (!uploadRec) return res.status(404).json({ message: 'File record not found' });

    // If user is LGA role, ensure they belong to the same LGA as the file
    if (req.user.role === 'LGA' && req.user.lgaId !== uploadRec.lgaId) return res.status(403).json({ message: 'Forbidden' });

    // Stream file
    return res.sendFile(filePath);
  } catch (e) {
    console.error('downloadFile error', e);
    return res.status(500).json({ message: 'Failed to download file' });
  }
}

module.exports = { uploadFile, myLga, all };
