import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

// Get auth token from AsyncStorage
const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('token');
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

type UploadProgressCallback = (progress: number) => void;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ads2go-integration-production.up.railway.app';

interface UploadOptions {
  onProgress?: (progress: number) => void;
  metadata?: Record<string, any>;
  folder?: string;
  documentType: 'license' | 'vehicle' | 'orcr' | 'profile';
}

/**
 * Upload a file to the server
 * This is the only upload method available for the driver app
 * All uploads go through the server for validation and processing
 */
export const uploadFile = async (
  fileUri: string,
  options: UploadOptions
) => {
  const { onProgress, metadata = {}, folder = 'driver-documents', documentType } = options;
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Authentication required');
  }

  // Get file info
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) {
    throw new Error('File does not exist');
  }

  // 10MB file size limit for server uploads
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (fileInfo.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  return uploadToServer(fileUri, { 
    onProgress, 
    metadata, 
    folder,
    documentType,
    token 
  });
};

const uploadToServer = async (
  fileUri: string,
  options: Required<Pick<UploadOptions, 'onProgress' | 'metadata' | 'folder' | 'documentType'>> & {
    token: string;
  }
) => {
  const { onProgress, metadata, folder, documentType, token } = options;
  
  // Get file info
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  const fileName = fileUri.split('/').pop() || `file-${Date.now()}`;
  const fileType = await FileSystem.getContentUriAsync(fileUri);
  
  // Create form data
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: fileType,
  } as any);
  
  formData.append('userId', 'driver-user'); // Will be validated by server using token
  formData.append('folder', folder);
  formData.append('documentType', documentType);
  formData.append('metadata', JSON.stringify(metadata));

  // Show upload progress
  const uploadProgressCallback = (uploadProgress: { totalBytesSent: number; totalBytesExpectedToSend: number }) => {
    const progress = uploadProgress.totalBytesSent / uploadProgress.totalBytesExpectedToSend;
    if (onProgress) {
      onProgress(progress);
    }
  };

  try {
    const uploadTask = FileSystem.createUploadTask(
      `${API_BASE_URL}/upload`,
      fileUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      },
      uploadProgressCallback
    );

    const response = await uploadTask.uploadAsync();
    
    if (response.httpStatusCode && response.httpStatusCode >= 400) {
      let errorMessage = 'Upload failed';
      try {
        // For server responses, we need to read the response body
        if (response.body) {
          const responseText = await response.body.text();
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      throw new Error(errorMessage);
    }

    // For successful uploads, the server should return JSON with the file details
    try {
      if (response.body) {
        const responseText = await response.body.text();
        return JSON.parse(responseText);
      }
      return { success: true, uri: fileUri };
    } catch (e) {
      console.error('Error parsing success response:', e);
      return { success: true, uri: fileUri };
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Note: Direct uploads with signed URLs are not used in the driver app
// This function is kept for reference but not exported

// Image Picker Helper for Driver Documents
export const pickDriverDocument = async (documentType: 'license' | 'vehicle' | 'orcr' | 'profile') => {
  try {
    const { launchImageLibraryAsync, MediaTypeOptions } = ImagePicker;
    
    const result = await launchImageLibraryAsync({
      mediaTypes: MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: false,
      exif: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return null;
    }

    const asset = result.assets[0];
    
    // Add document type to metadata
    const metadata = {
      documentType,
      uploadedAt: new Date().toISOString(),
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version,
      },
    };

    return {
      uri: asset.uri,
      type: asset.type || 'image',
      fileName: `driver-${documentType}-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      metadata,
    };
  } catch (error) {
    console.error('Error picking document:', error);
    Alert.alert('Error', 'Failed to select document. Please try again.');
    return null;
  }
};

// Upload Driver Document
interface UploadDriverDocumentOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export const uploadDriverDocument = async (
  fileUri: string,
  documentType: 'license' | 'vehicle' | 'orcr' | 'profile',
  options: UploadDriverDocumentOptions = {}
) => {
  const { onProgress, onSuccess, onError } = options;
  
  try {
    const result = await uploadFile(fileUri, {
      documentType,
      folder: 'driver-documents',
      metadata: {
        uploadSource: 'mobile-app',
        documentType,
        timestamp: new Date().toISOString(),
      },
      onProgress,
    });
    
    onSuccess?.(result);
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    onError?.(error instanceof Error ? error : new Error('Upload failed'));
    throw error;
  }
};
