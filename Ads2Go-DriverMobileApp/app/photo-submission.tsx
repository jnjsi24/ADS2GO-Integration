import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gql } from 'graphql-request';
import { request } from 'graphql-request';
import API_CONFIG from '../config/api';

// Move API_URL assignment inside the component to ensure it's available
const getAPIUrl = () => {
  console.log('🔍 API_CONFIG in photo-submission:', API_CONFIG);
  const url = API_CONFIG?.API_URL || 'http://localhost:5000/graphql';
  console.log('🔍 API_URL in photo-submission:', url);
  return url;
};

// GraphQL mutation to upload monthly photo
const UPLOAD_MONTHLY_PHOTO = gql`
  mutation UploadMonthlyPhoto($materialId: ID!, $photoUrls: [String!]!, $month: String!, $description: String) {
    uploadMonthlyPhoto(materialId: $materialId, photoUrls: $photoUrls, month: $month, description: $description) {
      success
      message
      materialTracking {
        id
        monthlyPhotos {
          month
          status
          photoUrls
          uploadedAt
        }
        photoComplianceStatus
        nextPhotoDue
      }
    }
  }
`;

// GraphQL query to get driver's materials with photo tracking
const GET_DRIVER_MATERIALS_WITH_PHOTOS = gql`
  query GetDriverMaterialsWithPhotos($driverId: ID!) {
    getDriverMaterials(driverId: $driverId) {
      success
      message
      materials {
        id
        materialId
        materialType
        materialName
        description
        status
        assignedDate
        mountedAt
        materialTracking {
          photoComplianceStatus
          nextPhotoDue
          lastPhotoUpload
          monthlyPhotos {
            month
            status
            photoUrls
            uploadedAt
            uploadedBy
            adminNotes
          }
        }
      }
    }
  }
`;

interface Material {
  id: string;
  materialId: string;
  materialType: string;
  materialName: string;
  description: string;
  status: string;
  assignedDate: string;
  mountedAt: string;
  materialTracking: {
    photoComplianceStatus: string;
    nextPhotoDue: string;
    lastPhotoUpload: string;
    monthlyPhotos: Array<{
      month: string;
      status: string;
      photoUrls: string[];
      uploadedAt: string;
      uploadedBy: string;
      adminNotes?: string;
    }>;
  };
}

interface PhotoUploadState {
  materialId: string;
  photos: string[];
  description: string;
  uploading: boolean;
}

export default function PhotoSubmission() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [photoUploads, setPhotoUploads] = useState<Map<string, PhotoUploadState>>(new Map());
  const [isPhotoDay, setIsPhotoDay] = useState(false);

  useEffect(() => {
    loadDriverData();
    checkPhotoDay();
  }, []);

  const checkPhotoDay = () => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Photo day is the 1st of every month
    const isFirstOfMonth = dayOfMonth === 1;
    setIsPhotoDay(isFirstOfMonth);
    
    console.log(`📅 Photo day check: Day ${dayOfMonth}, isFirstOfMonth: ${isFirstOfMonth}`);
  };

  const loadDriverData = async () => {
    try {
      setLoading(true);
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please login again.');
        router.replace('/(auth)/login');
        return;
      }

      const driverInfo = await AsyncStorage.getItem('driverInfo');
      if (!driverInfo) {
        Alert.alert('Error', 'Driver information not found. Please login again.');
        router.replace('/(auth)/login');
        return;
      }

      const driver = JSON.parse(driverInfo);
      const currentDriverId = driver.driverId || driver.id;
      setDriverId(currentDriverId);

      // Fetch materials with photo tracking
      const response = await request(getAPIUrl(), GET_DRIVER_MATERIALS_WITH_PHOTOS, {
        driverId: currentDriverId
      }, {
        'Authorization': `Bearer ${token}`
      }) as any;

      if (response.getDriverMaterials.success) {
        setMaterials(response.getDriverMaterials.materials);
        
        // Check if any materials need photos (newly mounted or monthly due)
        const materialsNeedingPhotos = response.getDriverMaterials.materials.filter((material: Material) => {
          const mountedDate = new Date(material.mountedAt);
          const daysSinceMounted = Math.floor((Date.now() - mountedDate.getTime()) / (1000 * 60 * 60 * 24));
          const isNewlyMounted = daysSinceMounted <= 7;
          const isMonthlyDue = isPhotoDay && !hasCurrentMonthPhoto(material);
          
          console.log(`📸 Material ${material.materialId}: mounted ${daysSinceMounted} days ago, isNewlyMounted: ${isNewlyMounted}, isMonthlyDue: ${isMonthlyDue}`);
          
          return isNewlyMounted || isMonthlyDue;
        });

        console.log(`📸 Materials needing photos: ${materialsNeedingPhotos.length}`);

        // Show photo upload UI if it's photo day OR if there are newly mounted materials
        if (isPhotoDay || materialsNeedingPhotos.length > 0) {
          setIsPhotoDay(true);
          console.log(`📸 Photo upload UI enabled: isPhotoDay=${isPhotoDay}, newMaterials=${materialsNeedingPhotos.length}`);
        }
      }
    } catch (error) {
      console.error('Error loading driver data:', error);
      Alert.alert('Error', 'Failed to load materials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasCurrentMonthPhoto = (material: Material) => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    return material.materialTracking?.monthlyPhotos?.some(photo => photo.month === currentMonth);
  };

  const isNewlyMounted = (material: Material) => {
    const mountedDate = new Date(material.mountedAt);
    const daysSinceMounted = Math.floor((Date.now() - mountedDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceMounted <= 7;
  };

  const needsPhoto = (material: Material) => {
    return isNewlyMounted(material) || (isPhotoDay && !hasCurrentMonthPhoto(material));
  };

  const pickImage = async (materialId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets.length > 0) {
        const photoUrls = result.assets.map(asset => asset.uri);
        
        setPhotoUploads(prev => {
          const newMap = new Map(prev);
          newMap.set(materialId, {
            materialId,
            photos: photoUrls,
            description: newMap.get(materialId)?.description || '',
            uploading: false
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadPhotos = async (materialId: string) => {
    const uploadState = photoUploads.get(materialId);
    if (!uploadState || uploadState.photos.length === 0) {
      Alert.alert('Error', 'Please select photos first.');
      return;
    }

    try {
      // Update uploading state
      setPhotoUploads(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(materialId);
        if (current) {
          newMap.set(materialId, { ...current, uploading: true });
        }
        return newMap;
      });

      const token = await AsyncStorage.getItem('token');
      const currentMonth = new Date().toISOString().slice(0, 7);

      // TODO: Upload photos to Firebase Storage first, then get URLs
      // For now, using placeholder URLs
      const photoUrls = uploadState.photos; // In real implementation, these would be Firebase URLs

      const response = await request(getAPIUrl(), UPLOAD_MONTHLY_PHOTO, {
        materialId,
        photoUrls,
        month: currentMonth,
        description: uploadState.description
      }, {
        'Authorization': `Bearer ${token}`
      }) as any;

      if (response.uploadMonthlyPhoto.success) {
        Alert.alert('Success', 'Photos uploaded successfully!');
        
        // Clear the upload state
        setPhotoUploads(prev => {
          const newMap = new Map(prev);
          newMap.delete(materialId);
          return newMap;
        });

        // Refresh materials
        loadDriverData();
      } else {
        Alert.alert('Error', response.uploadMonthlyPhoto.message || 'Failed to upload photos.');
      }
    } catch (error) {
      console.error('Error uploading photos:', error);
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    } finally {
      // Update uploading state
      setPhotoUploads(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(materialId);
        if (current) {
          newMap.set(materialId, { ...current, uploading: false });
        }
        return newMap;
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDriverData();
    setRefreshing(false);
  };

  if (!isPhotoDay) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photo Submission</Text>
        </View>
        
        <View style={styles.notPhotoDayContainer}>
          <Ionicons name="camera-outline" size={64} color="#CCCCCC" />
          <Text style={styles.notPhotoDayTitle}>No Photos Needed</Text>
          <Text style={styles.notPhotoDayText}>
            Photo submissions are only available on the 1st of each month or for newly mounted materials (within 7 days).
          </Text>
          <Text style={styles.nextPhotoDayText}>
            Next photo day: 1st of next month
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading materials...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo Submission</Text>
        <View style={styles.headerRight}>
          <Ionicons name="camera" size={24} color="#007AFF" />
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>📸 Photo Submission</Text>
          <Text style={styles.instructionsText}>
            Upload photos of your assigned materials for inspection. 
            This helps maintain quality and compliance.
          </Text>
        </View>

        {materials.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#CCCCCC" />
            <Text style={styles.emptyStateText}>No materials assigned</Text>
            <Text style={styles.emptyStateSubtext}>Contact your administrator to get assigned materials</Text>
          </View>
        ) : (
          materials.map((material) => {
            const uploadState = photoUploads.get(material.id);
            const needsPhotoUpload = needsPhoto(material);
            const hasCurrentPhoto = hasCurrentMonthPhoto(material);
            const isNew = isNewlyMounted(material);

            return (
              <View key={material.id} style={styles.materialCard}>
                <View style={styles.materialHeader}>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialId}>{material.materialId}</Text>
                    <Text style={styles.materialType}>{material.materialType}</Text>
                  </View>
                  <View style={styles.statusContainer}>
                    {isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                    {needsPhotoUpload && (
                      <View style={styles.photoNeededBadge}>
                        <Text style={styles.photoNeededBadgeText}>PHOTO NEEDED</Text>
                      </View>
                    )}
                    {hasCurrentPhoto && (
                      <View style={styles.photoUploadedBadge}>
                        <Text style={styles.photoUploadedBadgeText}>UPLOADED</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.materialDescription}>{material.description}</Text>

                {needsPhotoUpload && (
                  <View style={styles.photoUploadSection}>
                    <Text style={styles.photoUploadTitle}>Upload Photos</Text>
                    
                    {uploadState && uploadState.photos.length > 0 && (
                      <View style={styles.selectedPhotos}>
                        {uploadState.photos.map((photo, index) => (
                          <Image key={index} source={{ uri: photo }} style={styles.photoPreview} />
                        ))}
                      </View>
                    )}

                    <View style={styles.photoActions}>
                      <TouchableOpacity
                        style={styles.pickPhotoButton}
                        onPress={() => pickImage(material.id)}
                        disabled={uploadState?.uploading}
                      >
                        <Ionicons name="camera" size={20} color="#007AFF" />
                        <Text style={styles.pickPhotoButtonText}>
                          {uploadState?.photos.length ? 'Add More Photos' : 'Pick Photos'}
                        </Text>
                      </TouchableOpacity>

                      {uploadState && uploadState.photos.length > 0 && (
                        <TouchableOpacity
                          style={[styles.uploadButton, uploadState.uploading && styles.uploadButtonDisabled]}
                          onPress={() => uploadPhotos(material.id)}
                          disabled={uploadState.uploading}
                        >
                          {uploadState.uploading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                              <Text style={styles.uploadButtonText}>Upload Photos</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {hasCurrentPhoto && !needsPhotoUpload && (
                  <View style={styles.photoStatus}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <Text style={styles.photoStatusText}>Photos uploaded for this month</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  instructions: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  notPhotoDayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  notPhotoDayTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  notPhotoDayText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  nextPhotoDayText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  materialInfo: {
    flex: 1,
  },
  materialId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  materialType: {
    fontSize: 14,
    color: '#666',
  },
  materialDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  newBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  photoNeededBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoNeededBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  photoUploadedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoUploadedBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  photoUploadSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 12,
  },
  photoUploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  selectedPhotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pickPhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    gap: 8,
  },
  pickPhotoButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  photoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  photoStatusText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
});
