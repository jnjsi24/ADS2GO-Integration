// routes/upload.js
const express = require('express');
const multer = require('multer');
const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

router.post('/', (req, res, next) => {
  upload.single('file')(req, res, function(err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ 
        error: 'File upload failed',
        details: err.message,
        code: err.code
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded' });
    }
    
    try {
      res.json({ 
        success: true,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      });
    } catch (error) {
      console.error('Response error:', error);
      res.status(500).json({ 
        error: 'Error processing upload',
        details: error.message
      });
    }
  });
});

module.exports = router;
