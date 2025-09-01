const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } = require('firebase/storage');
const { storage } = require('../config/firebase');

class FirebaseStorageService {
  constructor() {
    this.storage = storage;
  }

  // ===== ADVERTISEMENTS (USER-created content) =====

  /**
   * Upload user's ad video/material to advertisements folder
   */
  async uploadUserAd(userId, adId, file, metadata = {}) {
    try {
      const fileName = `${userId}/${adId}/${file.originalname}`;
      const storageRef = ref(this.storage, `advertisements/${fileName}`);
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          userId,
          adId,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        success: true,
        fileName,
        downloadURL,
        metadata: snapshot.metadata
      };
    } catch (error) {
      console.error('Error uploading user ad:', error);
      throw new Error('Failed to upload user ad');
    }
  }

  /**
   * Get user's ad material URL from advertisements folder
   */
  async getUserAdURL(userId, adId, fileName) {
    try {
      const storageRef = ref(this.storage, `advertisements/${userId}/${adId}/${fileName}`);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error getting user ad URL:', error);
      return null;
    }
  }

  /**
   * List user's ad materials from advertisements folder
   */
  async listUserAds(userId) {
    try {
      const storageRef = ref(this.storage, `advertisements/${userId}`);
      const result = await listAll(storageRef);
      
      const ads = await Promise.all(
        result.items.map(async (item) => {
          const downloadURL = await getDownloadURL(item);
          return {
            name: item.name,
            url: downloadURL,
            path: item.fullPath
          };
        })
      );

      return ads;
    } catch (error) {
      console.error('Error listing user ads:', error);
      return [];
    }
  }

  /**
   * Delete user's ad material from advertisements folder
   */
  async deleteUserAd(userId, adId, fileName) {
    try {
      const storageRef = ref(this.storage, `advertisements/${userId}/${adId}/${fileName}`);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting user ad:', error);
      throw new Error('Failed to delete user ad');
    }
  }

  // ===== LEGACY SUPPORT (for existing code) =====

  /**
   * Upload ad video/material to advertisements folder (legacy method)
   * @deprecated Use uploadUserAd instead
   */
  async uploadAdMaterial(adId, file, metadata = {}) {
    console.warn('uploadAdMaterial is deprecated. Use uploadUserAd with userId parameter.');
    return this.uploadUserAd('legacy', adId, file, metadata);
  }

  /**
   * Get ad material URL from advertisements folder (legacy method)
   * @deprecated Use getUserAdURL instead
   */
  async getAdMaterialURL(adId, fileName) {
    console.warn('getAdMaterialURL is deprecated. Use getUserAdURL with userId parameter.');
    return this.getUserAdURL('legacy', adId, fileName);
  }

  /**
   * List ad materials from advertisements folder (legacy method)
   * @deprecated Use listUserAds instead
   */
  async listAdMaterials(adId) {
    console.warn('listAdMaterials is deprecated. Use listUserAds with userId parameter.');
    return this.listUserAds('legacy');
  }

  /**
   * Delete ad material from advertisements folder (legacy method)
   * @deprecated Use deleteUserAd instead
   */
  async deleteAdMaterial(adId, fileName) {
    console.warn('deleteAdMaterial is deprecated. Use deleteUserAd with userId parameter.');
    return this.deleteUserAd('legacy', adId, fileName);
  }

  // ===== DRIVERS (existing folder) =====

  /**
   * Upload driver document to drivers folder
   */
  async uploadDriverDocument(driverId, file, documentType = 'profile', metadata = {}) {
    try {
      const fileName = `${driverId}/${documentType}_${file.originalname}`;
      const storageRef = ref(this.storage, `drivers/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          driverId,
          documentType,
          uploadedAt: new Date().toISOString(),
          ...metadata
        }
      });

      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        success: true,
        fileName,
        downloadURL,
        metadata: snapshot.metadata
      };
    } catch (error) {
      console.error('Error uploading driver document:', error);
      throw new Error('Failed to upload driver document');
    }
  }

  /**
   * Get driver document URL from drivers folder
   */
  async getDriverDocumentURL(driverId, fileName) {
    try {
      const storageRef = ref(this.storage, `drivers/${driverId}/${fileName}`);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error getting driver document URL:', error);
      return null;
    }
  }

  /**
   * List driver documents from drivers folder
   */
  async listDriverDocuments(driverId) {
    try {
      const storageRef = ref(this.storage, `drivers/${driverId}`);
      const result = await listAll(storageRef);
      
      const documents = await Promise.all(
        result.items.map(async (item) => {
          const downloadURL = await getDownloadURL(item);
          return {
            name: item.name,
            url: downloadURL,
            path: item.fullPath
          };
        })
      );

      return documents;
    } catch (error) {
      console.error('Error listing driver documents:', error);
      return [];
    }
  }

  /**
   * Delete driver document from drivers folder
   */
  async deleteDriverDocument(driverId, fileName) {
    try {
      const storageRef = ref(this.storage, `drivers/${driverId}/${fileName}`);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting driver document:', error);
      throw new Error('Failed to delete driver document');
    }
  }

  // ===== TABLETS (new folder) =====

  /**
   * Upload tablet configuration
   */
  async uploadTabletConfig(tabletId, config) {
    try {
      const configData = JSON.stringify(config, null, 2);
      const configBlob = new Blob([configData], { type: 'application/json' });
      
      const storageRef = ref(this.storage, `tablets/${tabletId}/config.json`);
      const snapshot = await uploadBytes(storageRef, configBlob, {
        contentType: 'application/json',
        metadata: {
          tabletId,
          uploadedAt: new Date().toISOString()
        }
      });

      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        success: true,
        downloadURL,
        metadata: snapshot.metadata
      };
    } catch (error) {
      console.error('Error uploading tablet config:', error);
      throw new Error('Failed to upload tablet configuration');
    }
  }

  /**
   * Get tablet configuration
   */
  async getTabletConfig(tabletId) {
    try {
      const storageRef = ref(this.storage, `tablets/${tabletId}/config.json`);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Fetch the config file
      const response = await fetch(downloadURL);
      const config = await response.json();
      
      return config;
    } catch (error) {
      console.error('Error getting tablet config:', error);
      return null;
    }
  }

  /**
   * Upload tablet asset (images, videos, etc.)
   */
  async uploadTabletAsset(tabletId, assetType, file) {
    try {
      const fileName = `${tabletId}/${assetType}/${file.originalname}`;
      const storageRef = ref(this.storage, `tablets/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          tabletId,
          assetType,
          uploadedAt: new Date().toISOString()
        }
      });

      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        success: true,
        fileName,
        downloadURL,
        metadata: snapshot.metadata
      };
    } catch (error) {
      console.error('Error uploading tablet asset:', error);
      throw new Error('Failed to upload tablet asset');
    }
  }

  // ===== MATERIALS (new folder) =====

  /**
   * Upload material template or asset
   */
  async uploadMaterial(materialType, fileName, file) {
    try {
      const storageRef = ref(this.storage, `materials/${materialType}/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file.buffer, {
        contentType: file.mimetype,
        metadata: {
          materialType,
          uploadedAt: new Date().toISOString()
        }
      });

      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        success: true,
        fileName,
        downloadURL,
        metadata: snapshot.metadata
      };
    } catch (error) {
      console.error('Error uploading material:', error);
      throw new Error('Failed to upload material');
    }
  }

  /**
   * Get material URL
   */
  async getMaterialURL(materialType, fileName) {
    try {
      const storageRef = ref(this.storage, `materials/${materialType}/${fileName}`);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error getting material URL:', error);
      return null;
    }
  }

  /**
   * List materials by type
   */
  async listMaterials(materialType) {
    try {
      const storageRef = ref(this.storage, `materials/${materialType}`);
      const result = await listAll(storageRef);
      
      const materials = await Promise.all(
        result.items.map(async (item) => {
          const downloadURL = await getDownloadURL(item);
          return {
            name: item.name,
            url: downloadURL,
            path: item.fullPath
          };
        })
      );

      return materials;
    } catch (error) {
      console.error('Error listing materials:', error);
      return [];
    }
  }

  // ===== BULK OPERATIONS =====

  /**
   * Upload multiple ad materials
   */
  async uploadMultipleAdMaterials(adId, files) {
    try {
      const uploadPromises = files.map(file => 
        this.uploadAdMaterial(adId, file)
      );
      
      const results = await Promise.all(uploadPromises);
      
      return {
        success: true,
        uploaded: results.length,
        results
      };
    } catch (error) {
      console.error('Error uploading multiple ad materials:', error);
      throw new Error('Failed to upload multiple ad materials');
    }
  }

  /**
   * Upload multiple driver documents
   */
  async uploadMultipleDriverDocuments(driverId, files, documentTypes = []) {
    try {
      const uploadPromises = files.map((file, index) => 
        this.uploadDriverDocument(driverId, file, documentTypes[index] || 'document')
      );
      
      const results = await Promise.all(uploadPromises);
      
      return {
        success: true,
        uploaded: results.length,
        results
      };
    } catch (error) {
      console.error('Error uploading multiple driver documents:', error);
      throw new Error('Failed to upload multiple driver documents');
    }
  }

  // ===== UTILITY FUNCTIONS =====

  /**
   * Generate signed URL (for temporary access)
   */
  async generateSignedURL(path, expiresIn = 3600) {
    try {
      const storageRef = ref(this.storage, path);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Note: For signed URLs, you'd need to use Firebase Admin SDK
      // This is a simplified version
      return downloadURL;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path) {
    try {
      const storageRef = ref(this.storage, path);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Note: For full metadata, you'd need to use Firebase Admin SDK
      return {
        path,
        downloadURL,
        exists: true
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return {
        path,
        exists: false
      };
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(path) {
    try {
      const storageRef = ref(this.storage, path);
      await getDownloadURL(storageRef);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new FirebaseStorageService();
