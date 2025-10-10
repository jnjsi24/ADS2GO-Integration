import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, gql } from 'graphql-request';
import API_CONFIG from '../config/api';

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
        mountedAt
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

interface Material {
  id: string;
  materialId: string;
  materialType: string;
  materialName: string;
  description: string;
  status: string;
  assignedDate: string;
  mountedAt: string;
  location?: {
    address: string;
    coordinates: string;
  };
  materialTracking?: {
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

interface DriverAnalytics {
  driverId: string;
  vehiclePlateNumber: string;
  vehicleModel: string;
  vehicleType: string;
  deviceId: string;
  screenType: string;
  materialId: string;
  totalDistance: number;
  totalHours: number;
  hoursRemaining: number;
  averageSpeed: number;
  maxSpeed: number;
  qrImpressions: number;
  totalRoutes: number;
  isOnline: boolean;
  complianceRate: number;
}

export default function MaterialsScreen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    try {
      setLoading(true);
      
      // Load driver info from AsyncStorage
      const driverInfo = await AsyncStorage.getItem('driverInfo');
      if (!driverInfo) {
        Alert.alert('Error', 'No driver information found');
        return;
      }

      const driver = JSON.parse(driverInfo);
      const driverId = driver.driverId || driver.id;
      
      if (!driverId) {
        Alert.alert('Error', 'No driver ID found');
        return;
      }

      // Fetch both analytics and materials data
      await Promise.all([
        fetchDriverAnalytics(driverId),
        loadDriverMaterials(driverId)
      ]);
    } catch (error) {
      console.error('Error loading driver data:', error);
      Alert.alert('Error', 'Failed to load driver data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverAnalytics = async (driverId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found for analytics request');
        return;
      }

      // Use the same endpoint as the dashboard
      const response = await fetch(`${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalytics(result.data);
      } else {
        console.error('Analytics fetch failed:', result.message);
      }
    } catch (error) {
      console.error('Error fetching driver analytics:', error);
    }
  };

  const loadDriverMaterials = async (id: string) => {
    try {
      // Get the stored token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found for driver materials request');
        return;
      }
      
      const data = await request(API_URL, GET_DRIVER_MATERIALS, { driverId: id }, {
        Authorization: `Bearer ${token}`
      }) as any;
      
      if (data.getDriverMaterials?.success) {
        setMaterials(data.getDriverMaterials.materials || []);
      } else {
        // Treat non-success as empty materials to show empty state instead of error
        setMaterials([]);
      }
    } catch (error) {
      console.error('Error loading driver materials:', error);
      // Treat GraphQL 400/Unauthorized as empty state for a better UX
      setMaterials([]);
    }
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Materials</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3674B5" />
          <Text style={styles.loadingText}>Loading materials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const navigateToTab = (tabName: string) => {
    router.push(`/(tabs)/${tabName}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Materials</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Device Information Card */}
        {analytics && (
          <View style={styles.deviceCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="tablet-portrait" size={24} color="#3674B5" />
              <Text style={styles.cardTitle}>Device Information</Text>
            </View>
            
            <View style={styles.deviceInfoSection}>
              <View style={styles.deviceInfoRow}>
                <View style={styles.deviceInfoItem}>
                  <Ionicons name="tablet-portrait" size={20} color="#3674B5" />
                  <View style={styles.deviceInfoContent}>
                    <Text style={styles.deviceInfoLabel}>Device ID</Text>
                    <Text style={styles.deviceInfoValue}>{analytics.deviceId}</Text>
                  </View>
                </View>

                <View style={styles.deviceInfoItem}>
                  <Ionicons name="tv" size={20} color="#3674B5" />
                  <View style={styles.deviceInfoContent}>
                    <Text style={styles.deviceInfoLabel}>Device Type</Text>
                    <Text style={styles.deviceInfoValue}>{analytics.screenType}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.deviceInfoRow}>
                <View style={styles.deviceInfoItem}>
                  <Ionicons name="cube" size={20} color="#3674B5" />
                  <View style={styles.deviceInfoContent}>
                    <Text style={styles.deviceInfoLabel}>Material ID</Text>
                    <Text 
                      style={styles.deviceInfoValue}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {analytics.materialId}
                    </Text>
                  </View>
                </View>

                <View style={styles.deviceInfoItem}>
                  <Ionicons name="car" size={20} color="#3674B5" />
                  <View style={styles.deviceInfoContent}>
                    <Text style={styles.deviceInfoLabel}>Vehicle Plate</Text>
                    <Text style={styles.deviceInfoValue}>{analytics.vehiclePlateNumber}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Materials Section */}
        <View style={styles.materialsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Materials</Text>
            <Text style={styles.materialCount}>
              {materials.length > 0 ? materials.length : (analytics?.materialId ? 1 : 0)} assigned
            </Text>
          </View>

          {materials.length === 0 && !analytics?.materialId ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>No materials assigned yet</Text>
              <Text style={styles.emptyStateSubtext}>Contact your administrator to get assigned materials</Text>
            </View>
          ) : (
            <>
              {/* Show materials from GraphQL if available */}
              {materials.map((material) => (
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
                  </View>
                )}
              </View>
              ))}

              {/* Fallback: Show device material if GraphQL materials is empty but device has material */}
              {materials.length === 0 && analytics?.materialId && (
                <View style={styles.materialCard}>
                  <View style={styles.materialHeader}>
                    <View style={styles.materialInfo}>
                      <Text style={styles.materialId}>{analytics.materialId}</Text>
                      <Text style={styles.materialType}>Device Material</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor('ACTIVE') }]}>
                        ACTIVE
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.materialName}>Assigned Device Material</Text>
                  <Text style={styles.materialDescription}>
                    This material is assigned to your device and is currently active.
                  </Text>

                  <View style={styles.materialDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="tablet-portrait" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Device: {analytics.deviceId}
                      </Text>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <Ionicons name="car" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Vehicle: {analytics.vehiclePlateNumber}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigateToTab('dashboard')}
        >
          <Ionicons name="grid-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigateToTab('route')}
        >
          <Ionicons name="map-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>Route</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigateToTab('profile')}
        >
          <Ionicons name="person-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigateToTab('notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color="#9CA3AF" />
          <Text style={styles.navLabel}>Notifications</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80, // Add padding for bottom navigation bar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  deviceInfoSection: {
    gap: 12,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deviceInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deviceInfoContent: {
    marginLeft: 8,
    flex: 1,
  },
  deviceInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  deviceInfoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  materialsPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
  },
  materialsSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  materialCount: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  materialCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    color: '#1f2937',
  },
  materialType: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  materialName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  materialDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  materialDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
  },
  trackingSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  complianceBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  complianceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trackingDetails: {
    gap: 6,
  },
  trackingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
  },
  bottomNavBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    height: 65,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    color: '#9CA3AF',
  },
});
