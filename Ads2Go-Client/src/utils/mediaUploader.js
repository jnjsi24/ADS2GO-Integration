import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';

/**
 * Uploads a media file to Firebase Storage and saves its metadata to Firestore
 * @param {File} file - The file to upload (image or video)
 * @param {Object} location - Object containing latitude and longitude
 * @param {string} userId - ID of the user uploading the file
 * @param {Object} additionalData - Any additional data to store with the media
 * @returns {Promise<Object>} - Returns the download URL and file metadata
 */
export const uploadMediaWithLocation = async (file, location, userId, additionalData = {}) => {
  try {
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${timestamp}.${fileExt}`;
    
    // Create a reference to the file in Firebase Storage
    const storageRef = ref(storage, `media/${userId}/${fileName}`);
    
    // Upload the file
    const uploadTask = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(uploadTask.ref);
    
    // Prepare media metadata
    const mediaData = {
      name: file.name,
      type: file.type,
      size: file.size,
      downloadURL,
      storagePath: uploadTask.ref.fullPath,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      uploadedBy: userId,
      uploadedAt: serverTimestamp(),
      ...additionalData
    };
    
    // Save metadata to Firestore
    const mediaRef = doc(db, 'media', `${userId}_${timestamp}`);
    await setDoc(mediaRef, mediaData);
    
    return {
      success: true,
      downloadURL,
      metadata: mediaData
    };
    
  } catch (error) {
    console.error('Error uploading media:', error);
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
