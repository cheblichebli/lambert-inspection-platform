const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadToR2, deleteFromR2 } = require('../utils/r2');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// POST /api/upload
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const ext = req.file.originalname.split('.').pop();
    const folder = req.body.folder || 'general';
    const key = `${folder}/${uuidv4()}.${ext}`;

    const url = await uploadToR2(key, req.file.buffer, req.file.mimetype);

    res.json({ url, key, filename: req.file.originalname, size: req.file.size });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// DELETE /api/upload
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'No key provided' });
    await deleteFromR2(key);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
