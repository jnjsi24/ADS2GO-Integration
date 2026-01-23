// utils/firebaseStorage.js
const { bucket } = require('../firebase-admin');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  // Documents
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validates file before upload
 * @param {Object} file - File object with mimetype and createReadStream
 * @throws {Error} If file is invalid
 */
const validateFile = (file) => {
  if (!file) throw new Error('No file provided');
  
  // Check for either mimetype or type property
  const fileType = file.mimetype || file.type;
  
  if (!fileType) {
    throw new Error('File type is required');
  }
  
  // Check MIME type against allowed types (case insensitive)
  const normalizedType = fileType.toLowerCase();
  const allowedTypes = Object.keys(ALLOWED_MIME_TYPES).map(t => t.toLowerCase());
  
  if (!allowedTypes.includes(normalizedType)) {
    throw new Error(`Unsupported file type: ${fileType}. Allowed types: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`);
  }
  
  // Add the normalized type back to the file object
  file.mimetype = normalizedType;
};

/**
 * Retry helper function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Result of the function
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable (network errors)
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('network') ||
        error.message?.includes('timeout');
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⚠️ Upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

/**
 * Uploads a file to Firebase Storage with retry logic
 * @param {Object} file - File object with createReadStream and filename
 * @param {'drivers'|'advertisements'|'admin'} type - The type of upload (determines folder structure)
 * @param {string} userId - ID of the user uploading the file
 * @param {string} [subfolder] - Subfolder for driver documents (e.g., 'licenses', 'vehicles')
 * @returns {Promise<{url: string, path: string, filename: string, originalName: string, contentType: string}>}
 */
const uploadToFirebase = async (file, type, userId, subfolder = '') => {
  let effectiveName = 'unknown';
  let storagePath = null;
  let firebaseFile = null;
  
  try {
    // Check if Firebase bucket is initialized
    if (!bucket) {
      const errorMsg = 'Firebase Storage bucket is not initialized. Please check Firebase Admin SDK configuration and environment variables (FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, etc.)';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
    
    // Handle the case where file is a Promise
    const fileObj = await Promise.resolve(file);
    
    // Ensure we have a valid file object
    if (!fileObj) {
      throw new Error('No file provided');
    }
    
    // Validate the file (this will also normalize the mimetype)
    validateFile(fileObj);
    
    // Get file properties with fallbacks
    const { 
      createReadStream, 
      filename: originalName = 'file', 
      mimetype, 
      name,
      type: fileType 
    } = fileObj;
    
    // Use the most specific filename available
    effectiveName = name || originalName || 'file';
    const fileExt = path.extname(effectiveName) || `.${ALLOWED_MIME_TYPES[mimetype] || 'bin'}`;
    const newFilename = `${uuidv4()}${fileExt}`;
    
    // Build storage path based on upload type
    if (type === 'drivers') {
      if (!subfolder) throw new Error('Subfolder is required for driver uploads');
      storagePath = `drivers/${userId}/${subfolder}/${newFilename}`;
    } else if (type === 'admin') {
      // For admin profile pictures and other admin uploads
      storagePath = `admin/${userId}/${newFilename}`;
    } else {
      // For advertisements or other client uploads
      storagePath = `advertisements/${userId}/${newFilename}`;
    }

    firebaseFile = bucket.file(storagePath);

    // Create a write stream with proper metadata
    const metadata = {
      contentType: mimetype || fileType || 'application/octet-stream',
      metadata: {
        uploadedBy: userId,
        originalName: effectiveName,
        uploadType: type,
        timestamp: new Date().toISOString()
      }
    };
    
    // Buffer the file if it's a stream (needed for retry logic)
    let fileBuffer = null;
    if (createReadStream) {
      // Convert stream to buffer for retry capability
      const chunks = [];
      const readStream = createReadStream();
      
      fileBuffer = await new Promise((resolve, reject) => {
        let timeoutId;
        
        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
        };
        
        readStream.on('data', (chunk) => chunks.push(chunk));
        readStream.on('end', () => {
          cleanup();
          resolve(Buffer.concat(chunks));
        });
        readStream.on('error', (error) => {
          cleanup();
          reject(error);
        });
        
        // Set timeout for reading the stream (2 minutes)
        timeoutId = setTimeout(() => {
          readStream.destroy();
          reject(new Error('Stream read timeout: exceeded 2 minutes'));
        }, 2 * 60 * 1000);
      });
    } else if (fileObj.buffer || fileObj.arrayBuffer) {
      fileBuffer = fileObj.buffer || Buffer.from(await fileObj.arrayBuffer());
    } else {
      throw new Error('Unsupported file format: missing createReadStream or buffer');
    }

    // Upload with retry logic (now we can retry since we have the buffer)
    await retryWithBackoff(async () => {
      await firebaseFile.save(fileBuffer, {
        metadata,
        public: false
      });
    }, 3, 1000); // 3 retries with 1s base delay

    // Generate a signed URL for temporary access
    const [signedUrl] = await firebaseFile.getSignedUrl({
      action: 'read',
      expires: '03-01-2030', // Long expiry for driver documents
    });

    return {
      url: signedUrl,
      path: storagePath,
      filename: newFilename,
      originalName: effectiveName,
      contentType: mimetype
    };
  } catch (error) {
    console.error('❌ File upload error:', error.message, 'for file:', effectiveName || 'unknown');
    
    // Clean up partially uploaded file if it exists
    if (firebaseFile && storagePath) {
      try {
        const [exists] = await firebaseFile.exists();
        if (exists) {
          await firebaseFile.delete();
          console.log(`🧹 Cleaned up partially uploaded file: ${storagePath}`);
        }
      } catch (cleanupError) {
        console.error('⚠️ Failed to clean up partial upload:', cleanupError.message);
      }
    }
    
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Deletes a file from Firebase Storage
 * @param {string} fileUrl - The full URL of the file to delete
 * @returns {Promise<boolean>} - Success status
 */
const deleteFromFirebase = async (fileUrl) => {
  try {
    if (!fileUrl) {
      console.log('⚠️ No file URL provided for deletion');
      return true; // Consider it successful if no URL
    }

    // Extract the file path from the Firebase Storage URL
    // Firebase Storage URLs typically look like:
    // https://firebasestorage.googleapis.com/v0/b/bucket-name/o/path%2Fto%2Ffile?alt=media&token=...
    const urlPattern = /firebasestorage\.googleapis\.com\/v0\/b\/[^\/]+\/o\/([^?]+)/;
    const match = fileUrl.match(urlPattern);
    
    if (!match) {
      console.log('⚠️ Invalid Firebase Storage URL format:', fileUrl);
      return false;
    }

    // Decode the path (URL encoded)
    const filePath = decodeURIComponent(match[1]);
    console.log(`🗑️ Deleting file from Firebase Storage: ${filePath}`);

    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('⚠️ File does not exist in Firebase Storage:', filePath);
      return true; // Consider it successful if file doesn't exist
    }

    // Delete the file
    await file.delete();
    console.log(`✅ Successfully deleted file from Firebase Storage: ${filePath}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting file from Firebase Storage:', error.message);
    // Don't throw error - just log it and continue
    return false;
  }
};

module.exports = {
  uploadToFirebase,
  deleteFromFirebase,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
