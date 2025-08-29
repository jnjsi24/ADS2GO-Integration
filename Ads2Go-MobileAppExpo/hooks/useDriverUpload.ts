import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { pickDriverDocument, uploadDriverDocument, UploadDriverDocumentOptions } from '../utils/fileUpload';

type DocumentType = 'license' | 'vehicle' | 'orcr' | 'profile';

interface UseDriverUploadOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export const useDriverUpload = (options: UseDriverUploadOptions = {}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleProgress = useCallback((progress: number) => {
    setProgress(progress);
  }, []);

  const upload = useCallback(async (documentType: DocumentType) => {
    try {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      // 1. Pick document from device
      const document = await pickDriverDocument(documentType);
      if (!document) return null;

      // 2. Upload the document
      const uploadResult = await uploadDriverDocument(document.uri, documentType, {
        onProgress: handleProgress,
        onSuccess: (result) => {
          setResult(result);
          options.onSuccess?.(result);
        },
        onError: (error) => {
          setError(error);
          options.onError?.(error);
          Alert.alert('Upload Failed', error.message || 'Failed to upload document');
        },
      });

      return uploadResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed');
      setError(err);
      options.onError?.(err);
      Alert.alert('Error', err.message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [handleProgress, options]);

  return {
    upload,
    isUploading,
    progress,
    error,
    result,
    reset: () => {
      setError(null);
      setResult(null);
      setProgress(0);
    },
  };
};

// Example usage in a component:
/*
const LicenseUploader = () => {
  const { upload, isUploading, progress, error } = useDriverUpload({
    onSuccess: (result) => {
      console.log('Upload successful:', result);
    },
    onError: (error) => {
      console.error('Upload error:', error);
    },
  });

  return (
    <View>
      <Button
        title={isUploading ? 'Uploading...' : 'Upload License'}
        onPress={() => upload('license')}
        disabled={isUploading}
      />
      {isUploading && <ProgressBar progress={progress} />}
      {error && <Text style={{ color: 'red' }}>{error.message}</Text>}
    </View>
  );
};
*/
