import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import API_CONFIG from '../../config/api';
import ReportIssueModal from '../../components/ReportIssueModal';
import { request, gql } from 'graphql-request';

interface DriverProfile {
  driverId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  licenseNumber: string;
  vehiclePlateNumber: string;
  vehicleModel: string;
  vehicleType: string;
  isOnline: boolean;
  totalEarnings: number;
  totalDistance: number;
  totalHours: number;
  rating: number;
  joinDate: string;
  lastActive: string;
  profilePicture?: string | null;
}

interface Material {
  id: string;
  materialId: string;
  materialType: string;
  status: string;
  assignedDate: string;
  deviceId?: string;
  materialTracking?: {
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

type TabType = 'profile' | 'vehicle' | 'material';

const GET_DRIVER_PROFILE = `
  query GetDriverProfile($driverId: ID!) {
    getDriver(driverId: $driverId) {
      success
      message
      driver {
        driverId
        firstName
        lastName
        email
        contactNumber
        licenseNumber
        vehiclePlateNumber
        vehicleModel
        vehicleType
        accountStatus
        totalEarnings
        currentBalance
        dateJoined
        lastLogin
        profilePicture
        isEmailVerified
        preferredMaterialType
      }
    }
  }
`;

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

const GET_SALARY_SUMMARY = `
  query GetMySalarySummary {
    getMySalarySummary {
      success
      message
      summary {
        totalSalary
        totalCalculations
        averageMonthlySalary
      }
    }
  }
`;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [realTotalEarnings, setRealTotalEarnings] = useState<number>(0);
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const driverId = await AsyncStorage.getItem('driverId');

      if (!token || !driverId) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      // Fetch profile data
      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: GET_DRIVER_PROFILE,
          variables: { driverId },
        }),
      });

      const result = await response.json();

      let profileData: DriverProfile | null = null;

      if (result.data?.getDriver?.success && result.data.getDriver.driver) {
        const driverData = result.data.getDriver.driver;
        profileData = {
          driverId: driverData.driverId || 'Unknown',
          firstName: driverData.firstName || 'Driver',
          lastName: driverData.lastName || '',
          email: driverData.email || 'No email',
          phoneNumber: driverData.contactNumber || 'No phone',
          licenseNumber: driverData.licenseNumber || 'No license',
          vehiclePlateNumber: driverData.vehiclePlateNumber || 'Unknown',
          vehicleModel: driverData.vehicleModel || 'Unknown',
          vehicleType: driverData.vehicleType || 'Unknown',
          isOnline: driverData.accountStatus === 'ACTIVE',
          totalEarnings: driverData.totalEarnings || 0,
          totalDistance: 0,
          totalHours: 0,
          rating: 0,
          joinDate: driverData.dateJoined || new Date().toISOString(),
          lastActive: driverData.lastLogin || new Date().toISOString(),
          profilePicture: driverData.profilePicture || null,
        };
      } else {
        // Fallback to stored driver info if API fails
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        if (driverInfo) {
          const driver = JSON.parse(driverInfo);
          profileData = {
            driverId: driver.driverId || driver.id || 'Unknown',
            firstName: driver.firstName || 'Driver',
            lastName: driver.lastName || '',
            email: driver.email || 'No email',
            phoneNumber: driver.contactNumber || driver.phoneNumber || 'No phone',
            licenseNumber: driver.licenseNumber || 'No license',
            vehiclePlateNumber: driver.vehiclePlateNumber || 'Unknown',
            vehicleModel: driver.vehicleModel || 'Unknown',
            vehicleType: driver.vehicleType || 'Unknown',
            isOnline: driver.accountStatus === 'ACTIVE',
            totalEarnings: driver.totalEarnings || 0,
            totalDistance: 0,
            totalHours: 0,
            rating: 0,
            joinDate: driver.dateJoined || new Date().toISOString(),
            lastActive: driver.lastLogin || new Date().toISOString(),
            profilePicture: driver.profilePicture || null,
          };
        }
      }

      // Fetch TOTAL analytics (distance and hours since mountedAt)
      // Use the same approach as dashboard: fetch with period=daily including today
      try {
        // Step 1: Get real-time data to fetch materialMountedAt and today's metrics
        const realtimeResponse = await fetch(
          `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}?period=realtime`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        let materialMountedAt: string | null = null;
        let todayDistance = 0;
        let todayHours = 0;

        if (realtimeResponse.ok) {
          const realtimeResult = await realtimeResponse.json();
          if (realtimeResult.success && realtimeResult.data) {
            const realtimeData = realtimeResult.data;
            materialMountedAt = realtimeData.materialMountedAt;
            todayDistance = realtimeData.totalDistanceToday || 0;
            todayHours = realtimeData.currentHours || 0;
          }
        }

        // Step 2: Fetch historical data using daily period (from mountedAt to today)
        // Note: Today's data might not be archived yet, so we'll add it separately if needed
        if (materialMountedAt && profileData) {
          try {
            const mountedDate = new Date(materialMountedAt);
            mountedDate.setHours(0, 0, 0, 0);

            // Include today in the date range
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            const dailyUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}?period=daily&startDate=${mountedDate.toISOString()}&endDate=${today.toISOString()}`;
            
            const dailyResponse = await fetch(dailyUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (dailyResponse.ok) {
              const dailyResult = await dailyResponse.json();
              if (dailyResult.success && dailyResult.data?.dailyData?.aggregatedMetrics) {
                const aggregatedMetrics = dailyResult.data.dailyData.aggregatedMetrics;
                
                // Check if today's data is included in the historical data
                const todayDateStr = new Date().toISOString().split('T')[0];
                const dailyBreakdown = dailyResult.data.dailyData.dailyBreakdown || [];
                const hasTodayData = dailyBreakdown.some((day: any) => {
                  const dayDateStr = new Date(day.date).toISOString().split('T')[0];
                  return dayDateStr === todayDateStr;
                });

                if (hasTodayData) {
                  // Today's data is already in aggregated metrics, use it directly
                  profileData.totalDistance = aggregatedMetrics.totalDistance || 0;
                  profileData.totalHours = aggregatedMetrics.totalHours || 0;
                  
                  console.log('✅ Total analytics from daily endpoint (includes today):', {
                    totalDistance: profileData.totalDistance,
                    totalHours: profileData.totalHours
                  });
                } else {
                  // Today's data not archived yet, add it to historical total
                  profileData.totalDistance = (aggregatedMetrics.totalDistance || 0) + todayDistance;
                  profileData.totalHours = (aggregatedMetrics.totalHours || 0) + todayHours;
                  
                  console.log('✅ Total analytics (historical + today):', {
                    historicalDistance: aggregatedMetrics.totalDistance,
                    todayDistance,
                    totalDistance: profileData.totalDistance,
                    historicalHours: aggregatedMetrics.totalHours,
                    todayHours,
                    totalHours: profileData.totalHours
                  });
                }
              } else {
                // No aggregated metrics, use real-time data only
                profileData.totalDistance = todayDistance;
                profileData.totalHours = todayHours;
                console.log('ℹ️ No aggregated metrics, using real-time data only');
              }
            } else {
              // Daily fetch failed, use real-time data only
              profileData.totalDistance = todayDistance;
              profileData.totalHours = todayHours;
              console.log('⚠️ Daily fetch failed, using real-time data only');
            }
          } catch (dailyError) {
            console.log('Error fetching daily data:', dailyError);
            // Fallback to real-time data
            if (profileData) {
              profileData.totalDistance = todayDistance;
              profileData.totalHours = todayHours;
            }
          }
        } else {
          // No mountedAt, use real-time data only
          if (profileData) {
            profileData.totalDistance = todayDistance;
            profileData.totalHours = todayHours;
            console.log('⚠️ No mountedAt date, using real-time data only');
          }
        }
      } catch (error) {
        console.log('Analytics not available:', error);
      }

      // Fetch real salary data
      try {
        const salaryResponse = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: GET_SALARY_SUMMARY,
          }),
        });

        const salaryResult = await salaryResponse.json();
        if (salaryResult.data?.getMySalarySummary?.success) {
          const summary = salaryResult.data.getMySalarySummary.summary;
          setRealTotalEarnings(summary.totalSalary || 0);
        }
      } catch (error) {
        console.log('Salary data not available:', error);
      }

      setProfile(profileData);

      // Fetch materials
      try {
        const materialsData = await request(
          API_CONFIG.API_URL, 
          GET_DRIVER_MATERIALS, 
          { driverId }, 
          { Authorization: `Bearer ${token}` }
        ) as any;

        if (materialsData.getDriverMaterials?.success) {
          setMaterials(materialsData.getDriverMaterials.materials || []);
        }
      } catch (error) {
        console.log('Materials not available:', error);
        setMaterials([]);
      }

      // Fetch driver analytics for device ID
      await fetchDriverAnalytics(driverId);

    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
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

      // Use the same endpoint as the dashboard and materials screen
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

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const hasPendingPhoto = (material: Material) => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    return material.materialTracking?.monthlyPhotos?.some(photo => 
      photo.month === currentMonth && photo.status === 'PENDING'
    );
  };

  const hasAnyPendingPhotos = () => {
    return materials.some(material => hasPendingPhoto(material));
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3674B5" />
        <Text style={styles.loadingText}>Loading profile</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-circle-outline" size={64} color="#CCCCCC" />
        <Text style={styles.errorText}>Failed to load profile</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: '#ef4444' }]}
            onPress={handleSignOut}
          >
            <Text style={styles.retryButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <View style={styles.tabContent}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile!.email}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{profile!.phoneNumber}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>License Number</Text>
                <Text style={styles.infoValue}>{profile!.licenseNumber}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Joined</Text>
                <Text style={styles.infoValue}>{formatDate(profile!.joinDate)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Last Active</Text>
                <Text style={styles.infoValue}>{formatDate(profile!.lastActive)}</Text>
              </View>
            </View>
          </View>
        );
      
      case 'vehicle':
        return (
          <View style={styles.tabContent}>
            <View style={styles.infoRow}>
              <Ionicons name="car-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Plate Number</Text>
                <Text style={styles.infoValue}>{profile!.vehiclePlateNumber}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="car-sport-outline" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Model</Text>
                <Text style={styles.infoValue}>{profile!.vehicleModel}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="car-sport" size={20} color="#9ca3af" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{profile!.vehicleType}</Text>
              </View>
            </View>
          </View>
        );
      
      case 'material':
        return (
          <View style={styles.tabContent}>
            {materials.length > 0 ? (
              materials.map((material, index) => (
                <View key={material.id || index}>
                  <View style={styles.infoRow}>
                    <Ionicons name="cube-outline" size={20} color="#9ca3af" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>MATERIAL ID</Text>
                      <Text style={styles.infoValue}>{material.materialId}</Text>
                      <Text style={styles.materialStatus}>
                        {material.status === 'ACTIVE' ? 'MOUNTED' : material.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={20} color="#9ca3af" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Assigned</Text>
                      <Text style={styles.infoValue}>{formatDate(material.assignedDate)}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Ionicons name="tablet-portrait-outline" size={20} color="#9ca3af" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.deviceInfoLabel}>Device ID</Text>
                      <Text style={styles.infoValue}>{analytics?.deviceId || 'N/A'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                  <Ionicons name="tv-outline" size={20} color="#9ca3af" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Device Type</Text>
                    <Text style={styles.infoValue}>{analytics?.screenType || 'N/A'}</Text>
                  </View>
                </View>

                  {/* Compliance Upload Button */}
                  <TouchableOpacity 
                    style={[
                      styles.complianceActionButton,
                      hasAnyPendingPhotos() && styles.disabledButton
                    ]}
                    onPress={() => {
                      if (hasAnyPendingPhotos()) {
                        Alert.alert(
                          'Upload Disabled',
                          'You have photos pending admin approval. Please wait for approval before uploading new photos.',
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      router.push('/photo-submission');
                    }}
                    disabled={hasAnyPendingPhotos()}
                  >
                    <Ionicons 
                      name="cloud-upload" 
                      size={20} 
                      color={hasAnyPendingPhotos() ? "#999" : "#ffffff"} 
                    />
                    <Text style={[
                      styles.materialsActionText,
                      hasAnyPendingPhotos() && styles.disabledText
                    ]}>
                      {hasAnyPendingPhotos() ? 'Waiting for Admin Result' : 'Upload Compliance Photos'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="cube-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyStateText}>No materials assigned</Text>
                <Text style={styles.emptyStateSubtext}>Materials will appear here when assigned to you</Text>
              </View>
            )}
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        {/* Row 1: Header Icons */}
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/my-reports')}>
            <Ionicons name="document-text-outline" size={24} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowReportModal(true)}>
            <Ionicons name="mail-outline" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Row 2: Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileAvatarContainer}>
            {(() => {
              const getImageUrl = (src?: string | null) => {
                if (!src) return null;
                if (/^https?:\/\//i.test(src)) return src;
                return `${API_CONFIG.BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
              };
              const imgUrl = getImageUrl(profile.profilePicture);
              if (imgUrl) {
                return (
                  <Image
                    source={{ uri: imgUrl }}
                    style={{ width: 70, height: 70, borderRadius: 35 }}
                  />
                );
              }
              return <Ionicons name="person-circle" size={70} color="#5b8ec5" />;
            })()}
            {profile.isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {profile.firstName} {profile.lastName}
            </Text>
            <Text style={styles.driverId}>Driver ID: {profile.driverId}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
            Profile Information
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'vehicle' && styles.activeTab]}
          onPress={() => setActiveTab('vehicle')}
        >
          <Text style={[styles.tabText, activeTab === 'vehicle' && styles.activeTabText]}>
            Vehicle Information
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'material' && styles.activeTab]}
          onPress={() => setActiveTab('material')}
        >
          <Text style={[styles.tabText, activeTab === 'material' && styles.activeTabText]}>
            Material Information
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>

    {/* Report Issue Modal */}
    <ReportIssueModal
      visible={showReportModal}
      onClose={() => setShowReportModal(false)}
    />
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3674B5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingVertical: 24,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  headerIcons: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Align icons to the right
    alignItems: 'center',
    marginBottom: 20, // Add space between row 1 and row 2
    gap: 3,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileAvatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22c55e',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  iconButton: {
    padding: 4,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  driverId: {
    fontSize: 15,
    color: '#6b7280',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#ffffff',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  deviceInfoLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  materialStatus: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 4,
    fontWeight: '600',
  },
  materialsActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  complianceActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3674B5',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 60,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  disabledText: {
    color: '#999',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
});
