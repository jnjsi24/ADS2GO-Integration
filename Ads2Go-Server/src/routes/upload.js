const express = require('express');
const router = express.Router();
const { getStorage } = require('firebase-admin/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { db, admin } = require('../firebase-admin');
const { uploadToFirebase } = require('../utils/firebasestorage');

// Configure multer for memory storage and file size limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Middleware to verify authentication
const authenticate = (req, res, next) => {
  // Extract token from header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  // In a real app, verify the JWT token here
  // const token = authHeader.split(' ')[1];
  // ... verify token logic ...
  
  next();
};

/**
 * POST /upload
 * Server-side upload for sensitive files (driver docs, invoices, etc.)
 * Uses uploadToFirebase() to handle the upload
 */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    const { userId, folder = 'uploads', metadata = {} } = req.body;
    
    // Validate required fields
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'No file uploaded' 
      });
    }
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required field: userId' 
      });
    }
    
    // Basic file type validation
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'image/jpg'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Only JPG, PNG, and PDF are allowed.'
      });
    }

    // Create a sanitized filename
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const sanitizedFilename = `${Date.now()}_${uuidv4()}.${fileExt}`;
    const storagePath = `${folder}/${userId}/${sanitizedFilename}`;
    
    // Prepare file for upload
    const fileObj = {
      createReadStream: function* () {
        yield req.file.buffer;
      },
      filename: sanitizedFilename,
      mimetype: req.file.mimetype
    };

    // Upload to Firebase Storage
    const uploaded = await uploadToFirebase(fileObj, folder, userId, {
      ...metadata,
      originalName: req.file.originalname,
      uploadedBy: userId,
      uploadType: 'server',
      userAgent: req.headers['user-agent']
    });

    // Log the upload in Firestore for auditing
    const uploadLog = {
      userId,
      originalName: req.file.originalname,
      filePath: uploaded.path,
      fileUrl: uploaded.url,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: 'UPLOADED',
      uploadType: 'server',
      uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        ...metadata,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    };

    await db.collection('serverUploads').add(uploadLog);

    // Return success response
    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.url,
        path: uploaded.path,
        filename: uploaded.filename,
        originalName: req.file.originalname,
        contentType: uploaded.contentType,
        size: req.file.size,
        metadata: uploaded.metadata
      }
    });

  } catch (error) {
    console.error('❌ Document upload error:', error);
    
    // Log the error
    if (req.file) {
      await db.collection('uploadErrors').add({
        error: error.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: req.body.userId,
        documentType: req.body.documentType,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype
      });
    }

    // Return appropriate error response
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to upload document',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /upload/generate-url
 * Generates a signed URL for direct upload to Firebase Storage
 */
router.post('/generate-url', authenticate, async (req, res) => {
  try {
    const { userId, fileName, contentType, folder = 'direct-uploads', metadata = {} } = req.body;
    
    if (!userId || !fileName || !contentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, fileName, contentType'
      });
    }

    const storage = getStorage();
    const fileExt = fileName.split('.').pop().toLowerCase();
    const sanitizedFileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
    const filePath = `${folder}/${userId}/${sanitizedFileName}`;
    const fileRef = storage.bucket().file(filePath);
    
    // Generate signed URL with 15-minute expiration
    const [signedUrl] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      extensionHeaders: {
        'x-goog-meta-uploaded-by': userId,
        'x-goog-meta-original-filename': fileName,
        ...Object.entries(metadata).reduce((acc, [key, value]) => {
          acc[`x-goog-meta-${key}`] = String(value);
          return acc;
        }, {})
      }
    });

    // Log the signed URL generation
    await db.collection('signedUrlLogs').add({
      userId,
      filePath,
      fileName,
      contentType,
      signedUrl: signedUrl.split('?')[0], // Store without query params
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        ...metadata,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        signedUrl,
        filePath,
        fileName: sanitizedFileName,
        contentType,
        expiresIn: '15m'
      }
    });

  } catch (error) {
    console.error('❌ Error generating signed URL:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate signed URL',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
