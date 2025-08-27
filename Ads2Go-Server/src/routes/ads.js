const express = require('express');
const multer = require('multer');
const router = express.Router();
const { db, bucket } = require('../firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Configure multer for memory storage (we'll upload directly to Firebase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  },
});

// Upload multiple files (both images and videos)
const uploadMultiple = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]);

// Create a new ad with media
router.post('/', uploadMultiple, async (req, res) => {
  try {
    const { title, description, userId, price, duration, category } = req.body;
    const files = req.files;
    
    if (!title || !description || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload files to Firebase Storage
    const uploadPromises = [];
    const mediaUrls = [];

    // Process images
    if (files.images) {
      for (const file of files.images) {
        const fileName = `ads/${userId}/${uuidv4()}-${file.originalname}`;
        const fileUpload = bucket.file(fileName);
        
        const blobStream = fileUpload.createWriteStream({
          metadata: {
            contentType: file.mimetype,
            metadata: {
              uploadedBy: userId,
              originalName: file.originalname
            }
          }
        });

        const promise = new Promise((resolve, reject) => {
          blobStream.on('error', error => reject(error));
          blobStream.on('finish', async () => {
            // Make the file public
            await fileUpload.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
            mediaUrls.push({
              url: publicUrl,
              type: 'image',
              name: file.originalname,
              size: file.size
            });
            resolve();
          });
          blobStream.end(file.buffer);
        });
        uploadPromises.push(promise);
      }
    }

    // Process videos (similar to images)
    if (files.videos) {
      for (const file of files.videos) {
        const fileName = `ads/${userId}/videos/${uuidv4()}-${file.originalname}`;
        const fileUpload = bucket.file(fileName);
        
        const blobStream = fileUpload.createWriteStream({
          metadata: {
            contentType: file.mimetype,
            metadata: {
              uploadedBy: userId,
              originalName: file.originalname
            }
          }
        });

        const promise = new Promise((resolve, reject) => {
          blobStream.on('error', error => reject(error));
          blobStream.on('finish', async () => {
            // Make the file public
            await fileUpload.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
            mediaUrls.push({
              url: publicUrl,
              type: 'video',
              name: file.originalname,
              size: file.size
            });
            resolve();
          });
          blobStream.end(file.buffer);
        });
        uploadPromises.push(promise);
      }
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    // Create ad document in Firestore
    const adRef = await db.collection('ads').add({
      title,
      description,
      userId,
      price: parseFloat(price) || 0,
      duration: parseInt(duration) || 30, // Default 30 days
      category: category || 'general',
      media: mediaUrls,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      adId: adRef.id,
      media: mediaUrls
    });

  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({
      error: 'Failed to create ad',
      details: error.message
    });
  }
});

// Get all ads
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('ads').get();
    const ads = [];
    snapshot.forEach(doc => {
      ads.push({
        id: doc.id,
        ...doc.data()
      });
    });
    res.json(ads);
  } catch (error) {
    console.error('Error getting ads:', error);
    res.status(500).json({ error: 'Failed to get ads' });
  }
});

// Get ad by ID
router.get('/:id', async (req, res) => {
  try {
    const ad = await db.collection('ads').doc(req.params.id).get();
    if (!ad.exists) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    res.json({
      id: ad.id,
      ...ad.data()
    });
  } catch (error) {
    console.error('Error getting ad:', error);
    res.status(500).json({ error: 'Failed to get ad' });
  }
});

module.exports = router;
