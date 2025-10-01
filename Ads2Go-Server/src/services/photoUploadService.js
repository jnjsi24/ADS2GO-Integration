const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

class PhotoUploadService {
  constructor() {
    this.bucket = admin.storage().bucket();
  }

  /**
   * Upload photo to Firebase Storage
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} driverId - Driver ID
   * @param {string} materialId - Material ID
   * @param {string} month - Month in YYYY-MM format
   * @param {string} filename - Original filename
   * @returns {Promise<string>} - Firebase Storage URL
   */
  async uploadMonthlyPhoto(fileBuffer, driverId, materialId, month, filename) {
    try {
      // Create the file path in Firebase Storage
      const filePath = `materialtracking/${driverId}/${materialId}/monthly-photos/${month}/${filename}`;
      
      // Upload file to Firebase Storage
      const file = this.bucket.file(filePath);
      
      // Set metadata
      const metadata = {
        contentType: this.getContentType(filename),
        metadata: {
          driverId,
          materialId,
          month,
          uploadedAt: new Date().toISOString(),
          purpose: 'monthly-material-inspection'
        }
      };

      // Upload the file
      await file.save(fileBuffer, {
        metadata,
        resumable: false
      });

      // Make the file publicly accessible (optional - you can remove this if you want private access)
      await file.makePublic();

      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${filePath}`;
      
      console.log(`✅ Photo uploaded successfully: ${publicUrl}`);
      return publicUrl;

    } catch (error) {
      console.error('❌ Error uploading photo:', error);
      throw new Error(`Failed to upload photo: ${error.message}`);
    }
  }

  /**
   * Delete photo from Firebase Storage
   * @param {string} photoUrl - Firebase Storage URL
   * @returns {Promise<boolean>} - Success status
   */
  async deletePhoto(photoUrl) {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/');
      const bucketName = urlParts[3];
      const filePath = urlParts.slice(4).join('/');
      
      if (bucketName !== this.bucket.name) {
        throw new Error('Invalid bucket name in URL');
      }

      const file = this.bucket.file(filePath);
      await file.delete();
      
      console.log(`✅ Photo deleted successfully: ${photoUrl}`);
      return true;

    } catch (error) {
      console.error('❌ Error deleting photo:', error);
      throw new Error(`Failed to delete photo: ${error.message}`);
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} filename - Filename with extension
   * @returns {string} - MIME type
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    return contentTypes[ext] || 'image/jpeg';
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {string} driverId - Driver ID
   * @param {string} materialId - Material ID
   * @param {string} month - Month in YYYY-MM format
   * @returns {string} - Unique filename
   */
  generateUniqueFilename(originalName, driverId, materialId, month) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    
    return `${driverId}_${materialId}_${month}_${timestamp}_${randomId}${ext}`;
  }

  /**
   * Get photos for a specific material and month
   * @param {string} driverId - Driver ID
   * @param {string} materialId - Material ID
   * @param {string} month - Month in YYYY-MM format
   * @returns {Promise<Array>} - List of photo URLs
   */
  async getMonthlyPhotos(driverId, materialId, month) {
    try {
      const prefix = `materialtracking/${driverId}/${materialId}/monthly-photos/${month}/`;
      
      const [files] = await this.bucket.getFiles({
        prefix,
        delimiter: '/'
      });

      const photoUrls = files.map(file => {
        return `https://storage.googleapis.com/${this.bucket.name}/${file.name}`;
      });

      return photoUrls;

    } catch (error) {
      console.error('❌ Error getting monthly photos:', error);
      throw new Error(`Failed to get monthly photos: ${error.message}`);
    }
  }

  /**
   * Get storage usage statistics
   * @param {string} driverId - Driver ID (optional)
   * @returns {Promise<Object>} - Storage statistics
   */
  async getStorageStats(driverId = null) {
    try {
      let prefix = 'materialtracking/';
      if (driverId) {
        prefix += `${driverId}/`;
      }

      const [files] = await this.bucket.getFiles({
        prefix,
        delimiter: '/'
      });

      let totalSize = 0;
      let totalFiles = 0;

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalSize += parseInt(metadata.size || 0);
        totalFiles++;
      }

      return {
        totalFiles,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        driverId: driverId || 'all'
      };

    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }
}

// Export the service and multer middleware
module.exports = {
  PhotoUploadService,
  upload
};
