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
  RefreshControl,
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
            uploadedAt
            uploadedBy
            adminNotes
          }
        }
      }
    }
  }
`;

// GraphQL query to get driver's material usage history
const GET_DRIVER_USAGE_HISTORY = gql`
  query GetDriverUsageHistory($driverId: ID!) {
    getDriverUsageHistory(driverId: $driverId) {
      success
      message
      usageHistory {
        id
        materialId
        materialStringId
        assignedAt
        unassignedAt
        mountedAt
        dismountedAt
        usageDuration
        assignmentReason
        unassignmentReason
        customDismountReason
        notes
        isActive
      }
    }
  }
`;

interface MonthlyPhoto {
  month: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  photoUrls: string[];
  uploadedAt?: string;
  uploadedBy?: string;
  adminNotes?: string;
}

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
    monthlyPhotos: MonthlyPhoto[];
  };
}

interface UsageHistory {
  id: string;
  materialId: string;
  materialStringId: string;
  assignedAt: string;
  unassignedAt?: string;
  mountedAt?: string;
  dismountedAt?: string;
  usageDuration?: number;
  assignmentReason: string;
  unassignmentReason?: string;
  customDismountReason?: string;
  notes?: string;
  isActive: boolean;
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
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
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

      // Fetch analytics, materials, and usage history data
      await Promise.all([
        fetchDriverAnalytics(driverId),
        loadDriverMaterials(driverId),
        loadUsageHistory(driverId)
      ]);
    } catch (error) {
      console.error('Error loading driver data:', error);
      Alert.alert('Error', 'Failed to load driver data');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        // Handle 404 gracefully - device may have been unregistered
        if (response.status === 404) {
          // Device not registered - this is normal
          setAnalytics(null);
          return;
        }
        
        // Handle other errors
        console.warn(`Analytics endpoint error: ${response.status}`);
        setAnalytics(null);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAnalytics(result.data);
      } else {
        console.log('ℹ️ Analytics fetch unsuccessful:', result.message);
        setAnalytics(null);
      }
    } catch (error) {
      console.log('ℹ️ Could not fetch driver analytics - this is normal if device is not registered');
      setAnalytics(null);
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

  const loadUsageHistory = async (id: string) => {
    try {
      // Get the stored token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found for usage history request');
        return;
      }
      
      const data = await request(API_URL, GET_DRIVER_USAGE_HISTORY, { driverId: id }, {
        Authorization: `Bearer ${token}`
      }) as any;
      
      if (data.getDriverUsageHistory?.success) {
        // Filter out active records (they're already shown in current materials)
        const pastHistory = data.getDriverUsageHistory.usageHistory
          .filter((history: UsageHistory) => !history.isActive)
          .sort((a: UsageHistory, b: UsageHistory) => {
            // Sort by unassignedAt (most recent first)
            const dateA = a.unassignedAt ? new Date(a.unassignedAt).getTime() : 0;
            const dateB = b.unassignedAt ? new Date(b.unassignedAt).getTime() : 0;
            return dateB - dateA;
          });
        setUsageHistory(pastHistory);
      } else {
        setUsageHistory([]);
      }
    } catch (error) {
      console.error('Error loading usage history:', error);
      setUsageHistory([]);
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
      case 'PENDING': return '#FFC107';
      default: return '#757575';
    }
  };

  const getPhotoStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      case 'PENDING': return 'Waiting for review';
      default: return 'Status unknown';
    }
  };

  const getPhotoStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'checkmark-circle';
      case 'REJECTED': return 'close-circle';
      case 'PENDING': return 'time';
      default: return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString();
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
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDriverData(true)}
            colors={['#3674B5']}
            tintColor="#3674B5"
          />
        }>
        {/* Device Information Card */}
        {!analytics && (
          <View style={styles.noDeviceCard}>
            <View style={styles.noDeviceIconContainer}>
              <Ionicons name="information-circle-outline" size={48} color="#6b7280" />
            </View>
            <Text style={styles.noDeviceTitle}>No Device Registered</Text>
            <Text style={styles.noDeviceMessage}>
              Your device is not currently registered or has been unregistered by an administrator.
            </Text>
            <Text style={styles.noDeviceHint}>
              Please contact support if you need assistance with device registration.
            </Text>
          </View>
        )}

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

        {/* Past Materials Section */}
        {usageHistory.length > 0 && (
          <View style={styles.materialsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Past Materials</Text>
              <Text style={styles.materialCount}>
                {usageHistory.length} {usageHistory.length === 1 ? 'material' : 'materials'}
              </Text>
            </View>

            {usageHistory.map((history) => (
              <View key={history.id} style={styles.pastMaterialCard}>
                <View style={styles.materialHeader}>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialId}>{history.materialStringId}</Text>
                    <Text style={styles.pastMaterialBadge}>UNASSIGNED</Text>
                  </View>
                </View>

                <View style={styles.pastMaterialDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Assigned: {formatDate(history.assignedAt)}
                    </Text>
                  </View>
                  
                  {history.unassignedAt && (
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Unassigned: {formatDate(history.unassignedAt)}
                      </Text>
                    </View>
                  )}

                  {history.mountedAt && (
                    <View style={styles.detailItem}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                      <Text style={styles.detailText}>
                        Mounted: {formatDate(history.mountedAt)}
                      </Text>
                    </View>
                  )}

                  {history.dismountedAt && (
                    <View style={styles.detailItem}>
                      <Ionicons name="close-circle-outline" size={16} color="#F44336" />
                      <Text style={styles.detailText}>
                        Dismounted: {formatDate(history.dismountedAt)}
                      </Text>
                    </View>
                  )}

                  {history.usageDuration && (
                    <View style={styles.detailItem}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Duration: {Math.ceil(history.usageDuration / (1000 * 60 * 60 * 24))} days
                      </Text>
                    </View>
                  )}

                  {history.customDismountReason && (
                    <View style={styles.reasonContainer}>
                      <Text style={styles.reasonLabel}>Removal Reason:</Text>
                      <Text style={styles.reasonText}>{history.customDismountReason}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  noDeviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noDeviceIconContainer: {
    marginBottom: 16,
  },
  noDeviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDeviceMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  noDeviceHint: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
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
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  photoStatusContainer: {
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  photoStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  photoStatusItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoStatusText: {
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 14,
  },
  photoMonth: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 12,
  },
  photoUploadedAt: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  adminNotesContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F87171',
  },
  adminNotesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    marginBottom: 4,
  },
  adminNotesText: {
    fontSize: 12,
    color: '#7F1D1D',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 12,
  },
  refreshText: {
    color: '#2563EB',
    marginLeft: 8,
    fontWeight: '500',
  },
  refreshingIcon: {
    transform: [{ rotate: '360deg' }],
    animationKey: 'spin',
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  pastMaterialCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pastMaterialBadge: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '500',
  },
  pastMaterialDetails: {
    gap: 8,
    marginTop: 12,
  },
  reasonContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F87171',
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
  },
});
