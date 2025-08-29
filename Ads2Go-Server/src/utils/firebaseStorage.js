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
 * Uploads a file to Firebase Storage
 * @param {Object} file - File object with createReadStream and filename
 * @param {'drivers'|'advertisements'} type - The type of upload (determines folder structure)
 * @param {string} userId - ID of the user uploading the file
 * @param {string} [subfolder] - Subfolder for driver documents (e.g., 'licenses', 'vehicles')
 * @returns {Promise<{url: string, path: string, filename: string, originalName: string, contentType: string}>}
 */
const uploadToFirebase = async (file, type, userId, subfolder = '') => {
  let effectiveName = 'unknown';
  
  try {
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
    let storagePath;
    if (type === 'drivers') {
      if (!subfolder) throw new Error('Subfolder is required for driver uploads');
      storagePath = `drivers/${userId}/${subfolder}/${newFilename}`;
    } else {
      // For advertisements or other client uploads
      storagePath = `advertisements/${userId}/${newFilename}`;
    }

    const firebaseFile = bucket.file(storagePath);

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
    
    let stream;
    if (createReadStream) {
      // Handle GraphQL file uploads with createReadStream
      stream = createReadStream().pipe(firebaseFile.createWriteStream({
        metadata,
        public: false,
        validation: 'md5'
      }));
    } else if (fileObj.buffer || fileObj.arrayBuffer) {
      // Handle Buffer or ArrayBuffer
      const buffer = fileObj.buffer || Buffer.from(await fileObj.arrayBuffer());
      await firebaseFile.save(buffer, {
        metadata,
        public: false
      });
    } else {
      throw new Error('Unsupported file format: missing createReadStream or buffer');
    }

    // Handle upload progress/errors
    if (stream) {
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', (error) => {
          console.error('Upload error:', error);
          reject(new Error('File upload failed'));
        });
      });
    }

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
    throw new Error(`Upload failed: ${error.message}`);
  }
};

module.exports = {
  uploadToFirebase,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
