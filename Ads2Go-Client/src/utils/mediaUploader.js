import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase/init';

// Base URL for server-side uploads
<<<<<<< HEAD
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://ads2go-integration-production.up.railway.app/api';
=======
const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://192.168.100.22:5000').replace(/\/$/, '') + '/api';
>>>>>>> jairhon_cleanup-directory

/**
 * Uploads a file directly to Firebase Storage (for non-sensitive content)
 * @param {File} file - The file to upload
 * @param {string} path - The storage path (e.g., 'users/avatars', 'ads/media')
 * @param {string} userId - ID of the user uploading the file
 * @param {Object} metadata - Additional metadata to store with the file
 * @param {Function} onProgress - Optional progress callback (0-100)
 * @returns {Promise<Object>} - Returns the upload result
 */
export const uploadFileToFirebase = async (file, path, userId, metadata = {}, onProgress = null) => {
  try {
    // Create a unique filename with UUID
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const storagePath = `${path}/${fileName}`;
    
    // Create a reference to the file in Firebase Storage
    const storageRef = ref(storage, storagePath);
    
    // Create upload task with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy: userId,
        originalName: file.name,
        uploadType: 'direct',
        ...metadata
      }
    });

    // Set up progress tracking
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          // Progress tracking
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject({
            success: false,
            error: error.message || 'Upload failed',
            code: error.code
          });
        },
        async () => {
          try {
            // Upload complete, get the download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Log the upload in Firestore (optional)
            await logUploadInFirestore({
              userId,
              path: storagePath,
              url: downloadURL,
              type: file.type,
              size: file.size,
              metadata: {
                uploadType: 'direct',
                ...metadata
              }
            });
            
            resolve({
              success: true,
              url: downloadURL,
              path: storagePath,
              name: file.name,
              type: file.type,
              size: file.size,
              metadata: uploadTask.snapshot.metadata
            });
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject({
              success: false,
              error: 'Failed to get download URL',
              details: error.message
            });
          }
        }
      );
    });
    
  } catch (error) {
    console.error('Error in uploadFileToFirebase:', error);
    return {
      success: false,
      error: error.message || 'Upload failed',
      code: error.code
    };
  }
};

/**
 * Uploads a driver document through the server (for sensitive documents)
 * @param {File} file - The document file to upload
 * @param {string} documentType - Type of document ('license', 'vehicle', 'orcr', 'profile')
 * @param {string} userId - ID of the driver
 * @param {Function} onProgress - Optional progress callback (0-100)
 * @returns {Promise<Object>} - Returns the upload result
 */
export const uploadDriverDocument = async (file, documentType, userId, onProgress = null) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('documentType', documentType);

    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response.data);
            } else {
              reject({
                success: false,
                error: response.error || 'Upload failed',
                status: xhr.status
              });
            }
          } catch (e) {
            reject({
              success: false,
              error: 'Invalid server response',
              status: xhr.status
            });
          }
        } else {
          let error = 'Upload failed';
          try {
            const response = JSON.parse(xhr.responseText);
            error = response.error || error;
          } catch (e) {}
          
          reject({
            success: false,
            error,
            status: xhr.status
          });
        }
      };

      xhr.onerror = () => {
        reject({
          success: false,
          error: 'Network error',
          status: 0
        });
      };

      xhr.open('POST', `${API_BASE_URL}/upload/driver-documents`, true);
      
      // Add authorization header if user is authenticated
      const token = localStorage.getItem('authToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      
      xhr.send(formData);
    });
    
  } catch (error) {
    console.error('Error in uploadDriverDocument:', error);
    return {
      success: false,
      error: error.message || 'Upload failed',
      code: error.code
    };
  }
};

/**
 * Logs the upload in Firestore for auditing
 * @private
 */
async function logUploadInFirestore({ userId, path, url, type, size, metadata = {} }) {
  try {
    const uploadLog = {
      userId,
      path,
      url,
      type,
      size,
      metadata: {
        ...metadata,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent
      },
      status: 'COMPLETED',
      uploadedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'uploadLogs', `${userId}_${Date.now()}`), uploadLog);
  } catch (error) {
    console.error('Error logging upload to Firestore:', error);
  }
}

/**
 * Uploads a media file to Firebase Storage with geolocation (legacy support)
 * @deprecated Use uploadFileToFirebase or uploadDriverDocument instead
 */
export const uploadMediaWithLocation = async (file, location, userId, additionalData = {}) => {
  try {
    const result = await uploadFileToFirebase(
      file, 
      `media/${userId}`, 
      userId, 
      {
        location: {
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy
        },
        ...additionalData
      }
    );

    // Save metadata to Firestore for backward compatibility
    if (result.success) {
      const mediaRef = doc(db, 'media', `${userId}_${Date.now()}`);
      await setDoc(mediaRef, {
        name: file.name,
        type: file.type,
        size: file.size,
        downloadURL: result.url,
        storagePath: result.path,
        location: result.metadata?.location,
        uploadedBy: userId,
        uploadedAt: serverTimestamp(),
        ...additionalData
      });
    }

    return result;
  } catch (error) {
    console.error('Error in uploadMediaWithLocation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Gets the current geolocation of the device
 * @returns {Promise<Object>} - Returns latitude and longitude
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  });
};

/**
 * Handles file selection and upload with geolocation
 * @param {Event} event - The file input change event
 * @param {string} userId - ID of the current user
 * @returns {Promise<Object>} - Upload result
 */
export const handleMediaUpload = async (event, userId) => {
  const file = event.target.files[0];
  if (!file) return { success: false, error: 'No file selected' };

  try {
    // Get current location
    const location = await getCurrentLocation();
    
    // Upload file with location data
    return await uploadMediaWithLocation(file, location, userId, {
      originalName: file.name,
      fileType: file.type.split('/')[0] // 'image' or 'video'
    });
    
  } catch (error) {
    console.error('Error in handleMediaUpload:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload media'
    };
  }
};

export default {
  uploadMediaWithLocation,
  getCurrentLocation,
  handleMediaUpload
};
