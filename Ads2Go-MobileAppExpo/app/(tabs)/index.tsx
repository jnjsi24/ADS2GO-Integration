import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, gql } from 'graphql-request';
import API_CONFIG from '../../config/api';

const API_URL = API_CONFIG.API_URL;

// GraphQL query to get driver's materials
const GET_DRIVER_MATERIALS = gql`
  query GetDriverMaterials($driverId: ID!) {
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
        location {
          address
          coordinates
        }
        materialTracking {
          photoComplianceStatus
          nextPhotoDue
          lastPhotoUpload
          monthlyPhotos {
            month
            status
            photoUrls
          }
        }
      }
    }
  }
`;

// GraphQL query to get driver profile
const GET_DRIVER_PROFILE = gql`
  query GetDriverProfile($driverId: ID!) {
    getDriver(driverId: $driverId) {
      success
      message
      driver {
        id
        driverId
        firstName
        lastName
        email
        accountStatus
        profilePicture
        vehiclePlateNumber
        vehicleType
        preferredMaterialType
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
  location: {
    address: string;
    coordinates: number[];
  };
  materialTracking: {
    photoComplianceStatus: string;
    nextPhotoDue: string;
    lastPhotoUpload: string;
    monthlyPhotos: Array<{
      month: string;
      status: string;
      photoUrls: string[];
    }>;
  };
}

interface DriverProfile {
  id: string;
  driverId: string;
  firstName: string;
  lastName: string;
  email: string;
  accountStatus: string;
  profilePicture: string;
  vehiclePlateNumber: string;
  vehicleType: string;
  preferredMaterialType: string[];
}

export default function Home() {
  const navigation = useNavigation();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      console.log('🔍 Loading driver data...');
      
      // Debug: Check what's in AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('AsyncStorage keys:', allKeys);
      
      // Check if token exists
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found in AsyncStorage');
        Alert.alert('Error', 'Authentication token not found. Please login again.');
        // @ts-ignore
        navigation.navigate('(auth)/login');
        return;
      }
      console.log('✅ Token found:', token.substring(0, 20) + '...');
      
      // Try to get driverId from AsyncStorage
      let storedDriverId = await AsyncStorage.getItem('driverId');
      console.log('Stored driverId:', storedDriverId);
      
      // If driverId not found, try to get it from driverInfo
      if (!storedDriverId) {
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        console.log('DriverInfo from AsyncStorage:', driverInfo);
        
        if (driverInfo) {
          try {
            const driver = JSON.parse(driverInfo);
            console.log('Parsed driver object:', driver);
            storedDriverId = driver.driverId || driver.id;
            console.log('Extracted driverId:', storedDriverId);
            
            if (storedDriverId) {
              // Store it for future use
              await AsyncStorage.setItem('driverId', storedDriverId);
              console.log('Stored driverId for future use:', storedDriverId);
            }
          } catch (parseError) {
            console.error('Error parsing driverInfo:', parseError);
          }
        }
      }
      
      if (!storedDriverId) {
        console.log('❌ No driverId found in AsyncStorage');
        Alert.alert('Error', 'Driver ID not found. Please login again.');
        // @ts-ignore
        navigation.navigate('(auth)/login');
        return;
      }

      console.log('✅ Using driverId:', storedDriverId);
      setDriverId(storedDriverId);
      await Promise.all([
        loadDriverProfile(storedDriverId),
        loadDriverMaterials(storedDriverId)
      ]);
    } catch (error) {
      console.error('Error loading driver data:', error);
      Alert.alert('Error', 'Failed to load driver data');
    } finally {
      setLoading(false);
    }
  };

  const loadDriverProfile = async (id: string) => {
    try {
      // Get the stored token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found for driver profile request');
        return;
      }

      const data = await request(API_URL, GET_DRIVER_PROFILE, { driverId: id }, {
        Authorization: `Bearer ${token}`
      }) as any;
      
      if (data.getDriver?.success) {
        setDriverProfile(data.getDriver.driver);
      } else {
        console.error('Driver profile request failed:', data.getDriver?.message);
      }
    } catch (error) {
      console.error('Error loading driver profile:', error);
    }
  };

  const loadDriverMaterials = async (id: string) => {
    try {
      // Get the stored token
      const token = await AsyncStorage.getItem('token');
      const data = await request(API_URL, GET_DRIVER_MATERIALS, { driverId: id }, {
        Authorization: `Bearer ${token}`
      }) as any;
      
      if (data.getDriverMaterials?.success) {
        setMaterials(data.getDriverMaterials.materials || []);
      } else {
        console.error('Materials request failed:', data.getDriverMaterials?.message);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (driverId) {
      await Promise.all([
        loadDriverProfile(driverId),
        loadDriverMaterials(driverId)
      ]);
    }
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            // Clear all stored data
            await AsyncStorage.multiRemove([
              'token',
              'driverId',
              'driverInfo',
              'pendingDriver'
            ]);
            console.log('Logged out - cleared AsyncStorage');
            // @ts-ignore
            navigation.navigate('(auth)/login');
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#4CAF50';
      case 'INACTIVE': return '#F44336';
      case 'PENDING': return '#FF9800';
      default: return '#757575';
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return '#4CAF50';
      case 'NON_COMPLIANT': return '#F44336';
      case 'OVERDUE': return '#FF9800';
      default: return '#757575';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getNextPhotoDueText = (nextPhotoDue: string) => {
    const dueDate = new Date(nextPhotoDue);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Overdue by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.profileInfo}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.driverName}>
              {driverProfile?.firstName} {driverProfile?.lastName}
            </Text>
            <Text style={styles.driverId}>{driverProfile?.driverId}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#F44336" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.statusCard}>
          <View style={styles.statusItem}>
            <Ionicons name="car-outline" size={20} color="#007AFF" />
            <Text style={styles.statusText}>{driverProfile?.vehicleType}</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="card-outline" size={20} color="#007AFF" />
            <Text style={styles.statusText}>{driverProfile?.vehiclePlateNumber}</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="checkmark-circle-outline" size={20} color={getStatusColor(driverProfile?.accountStatus || '')} />
            <Text style={[styles.statusText, { color: getStatusColor(driverProfile?.accountStatus || '') }]}>
              {driverProfile?.accountStatus}
            </Text>
          </View>
        </View>
      </View>

      {/* Materials Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Materials</Text>
          <Text style={styles.materialCount}>{materials.length} assigned</Text>
        </View>

        {materials.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#CCCCCC" />
            <Text style={styles.emptyStateText}>No materials assigned yet</Text>
            <Text style={styles.emptyStateSubtext}>Contact your administrator to get assigned materials</Text>
          </View>
        ) : (
          materials.map((material) => (
            <View key={material.id} style={styles.materialCard}>
              <View style={styles.materialHeader}>
                <View style={styles.materialInfo}>
                  <Text style={styles.materialId}>{material.materialId}</Text>
                  <Text style={styles.materialType}>{material.materialType}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(material.status) }]}>
                    {material.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.materialName}>{material.materialName}</Text>
              <Text style={styles.materialDescription}>{material.description}</Text>

              <View style={styles.materialDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    Assigned: {formatDate(material.assignedDate)}
                  </Text>
                </View>
                
                {material.location?.address && (
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.detailText} numberOfLines={2}>
                      {material.location.address}
                    </Text>
                  </View>
                )}
              </View>

              {/* Material Tracking Info */}
              {material.materialTracking && (
                <View style={styles.trackingSection}>
                  <View style={styles.trackingHeader}>
                    <Text style={styles.trackingTitle}>Photo Compliance</Text>
                    <View style={styles.complianceBadge}>
                      <Text style={[
                        styles.complianceBadgeText, 
                        { color: getComplianceColor(material.materialTracking.photoComplianceStatus) }
                      ]}>
                        {material.materialTracking.photoComplianceStatus}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.trackingDetails}>
                    <View style={styles.trackingItem}>
                      <Ionicons name="camera-outline" size={16} color="#666" />
                      <Text style={styles.trackingText}>
                        Next photo: {getNextPhotoDueText(material.materialTracking.nextPhotoDue)}
                      </Text>
                    </View>
                    
                    {material.materialTracking.lastPhotoUpload && (
                      <View style={styles.trackingItem}>
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.trackingText}>
                          Last upload: {formatDate(material.materialTracking.lastPhotoUpload)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Monthly Photos Summary */}
                  {material.materialTracking.monthlyPhotos && material.materialTracking.monthlyPhotos.length > 0 && (
                    <View style={styles.monthlyPhotosSection}>
                      <Text style={styles.monthlyPhotosTitle}>Monthly Photos</Text>
                      <View style={styles.monthlyPhotosGrid}>
                        {material.materialTracking.monthlyPhotos.map((month, index) => (
                          <View key={index} style={styles.monthPhoto}>
                            <Text style={styles.monthText}>{month.month}</Text>
                            <View style={[
                              styles.monthStatus, 
                              { backgroundColor: getComplianceColor(month.status) }
                            ]}>
                              <Text style={styles.monthStatusText}>{month.status}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="camera-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Upload Photos</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="document-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>View Documents</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="settings-outline" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  profileInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  driverId: {
    fontSize: 14,
    color: '#999',
  },
  logoutButton: {
    padding: 8,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  materialCount: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  materialCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  materialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  materialInfo: {
    flex: 1,
  },
  materialId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  materialType: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  materialName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  materialDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  materialDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  trackingSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  complianceBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  complianceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trackingDetails: {
    marginBottom: 16,
  },
  trackingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  monthlyPhotosSection: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  monthlyPhotosTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  monthlyPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthPhoto: {
    alignItems: 'center',
    minWidth: 60,
  },
  monthText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  monthStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  monthStatusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    minWidth: 80,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
});
