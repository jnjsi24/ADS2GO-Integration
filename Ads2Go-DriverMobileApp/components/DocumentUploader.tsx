import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDriverUpload } from '../hooks/useDriverUpload';

type DocumentType = 'license' | 'vehicle' | 'orcr' | 'profile';

interface DocumentUploaderProps {
  documentType: DocumentType;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onUploadSuccess?: (result: any) => void;
  onUploadError?: (error: Error) => void;
  style?: any;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  documentType,
  label,
  icon,
  onUploadSuccess,
  onUploadError,
  style,
}) => {
  const { upload, isUploading, progress, error, result } = useDriverUpload({
    onSuccess: onUploadSuccess,
    onError: onUploadError,
  });

  const getStatusColor = () => {
    if (error) return '#ff4444';
    if (result) return '#4CAF50';
    return '#2196F3';
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[styles.button, { borderColor: getStatusColor() }]}
        onPress={() => upload(documentType)}
        disabled={isUploading}
      >
        <View style={styles.buttonContent}>
          <MaterialIcons 
            name={icon} 
            size={24} 
            color={getStatusColor()} 
            style={styles.icon} 
          />
          <Text style={[styles.buttonText, { color: getStatusColor() }]}>
            {isUploading ? 'Uploading...' : label}
          </Text>
          
          {isUploading && (
            <View style={styles.progressContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { 
                    width: `${progress * 100}%`,
                    backgroundColor: getStatusColor(),
                  }
                ]} 
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {error && (
        <Text style={styles.errorText}>
          {error.message || 'Failed to upload document'}
        </Text>
      )}

      {result && (
        <View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
          <Text style={styles.successText}>Upload successful</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  button: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginLeft: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  errorText: {
    color: '#ff4444',
    marginTop: 4,
    fontSize: 12,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  successText: {
    color: '#4CAF50',
    marginLeft: 4,
    fontSize: 12,
  },
});

// Example usage:
/*
<DocumentUploader
  documentType="license"
  label="Driver's License"
  icon="credit-card"
  onUploadSuccess={(result) => {
    // Handle successful upload
    console.log('License uploaded:', result);
  }}
  onUploadError={(error) => {
    // Handle upload error
    console.error('Upload failed:', error);
  }}
/>
*/
