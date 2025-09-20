import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';

interface MaterialPhotoUploadProps {
  materialId: string;
  driverId: string;
  onUploadSuccess?: (data: any) => void;
  onUploadError?: (error: string) => void;
}

interface PhotoFile {
  uri: string;
  type: string;
  name: string;
}

export const MaterialPhotoUpload: React.FC<MaterialPhotoUploadProps> = ({
  materialId,
  driverId,
  onUploadSuccess,
  onUploadError,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [currentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const cameraRef = useRef<Camera>(null);

  // Request camera permissions
  React.useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Request media library permissions
  React.useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant permission to access your photo library');
        }
      }
    })();
  }, []);

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });

        const photoFile: PhotoFile = {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `photo_${Date.now()}.jpg`,
        };

        setPhotos(prev => [...prev, photoFile]);
        setShowCamera(false);
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets) {
        const newPhotos: PhotoFile[] = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'image/jpeg',
          name: `photo_${Date.now()}_${Math.random()}.jpg`,
        }));

        setPhotos(prev => [...prev, ...newPhotos]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert('No Photos', 'Please add at least one photo before uploading');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('materialId', materialId);
      formData.append('month', currentMonth);

      photos.forEach((photo, index) => {
        formData.append('photos', {
          uri: photo.uri,
          type: photo.type,
          name: photo.name,
        } as any);
      });

      const response = await fetch('https://ads2go-integration-production.up.railway.app/material-photos/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${driverId}`, // You'll need to implement proper auth
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert('Success', 'Photos uploaded successfully!');
        setPhotos([]);
        onUploadSuccess?.(result.data);
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert('Upload Error', errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <ThemedText>Requesting camera permission...</ThemedText>
      </ThemedView>
    );
  }

  if (hasPermission === false) {
    return (
      <ThemedView style={styles.container}>
        <Ionicons name="camera-off" size={64} color={Colors.light.text} />
        <ThemedText style={styles.permissionText}>
          No access to camera
        </ThemedText>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <ThemedText style={styles.buttonText}>Pick from Gallery</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <Camera style={styles.camera} type={cameraType} ref={cameraRef}>
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => setCameraType(cameraType === CameraType.back ? CameraType.front : CameraType.back)}
            >
              <Ionicons name="camera-reverse" size={30} color="white" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.captureContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </Camera>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Monthly Material Photos</ThemedText>
          <ThemedText style={styles.subtitle}>
            Material: {materialId} | Month: {currentMonth}
          </ThemedText>
        </View>

        <View style={styles.photoActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowCamera(true)}>
            <Ionicons name="camera" size={24} color={Colors.light.tint} />
            <ThemedText style={styles.actionButtonText}>Take Photo</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Ionicons name="images" size={24} color={Colors.light.tint} />
            <ThemedText style={styles.actionButtonText}>Pick from Gallery</ThemedText>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <View style={styles.photosSection}>
            <ThemedText style={styles.sectionTitle}>
              Selected Photos ({photos.length}/5)
            </ThemedText>
            
            <View style={styles.photosGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="red" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
              onPress={uploadPhotos}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="cloud-upload" size={24} color="white" />
              )}
              <ThemedText style={styles.uploadButtonText}>
                {uploading ? 'Uploading...' : 'Upload Photos'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {photos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={64} color={Colors.light.text} />
            <ThemedText style={styles.emptyStateText}>
              No photos selected
            </ThemedText>
            <ThemedText style={styles.emptyStateSubtext}>
              Take photos or pick from gallery to get started
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    minWidth: 120,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  photosSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  photoContainer: {
    width: '48%',
    marginBottom: 16,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  cameraButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  captureContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  permissionText: {
    fontSize: 16,
    marginVertical: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
