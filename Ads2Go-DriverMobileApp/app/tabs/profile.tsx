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
          };
        }
      }

      // Fetch TOTAL analytics (distance and hours since mountedAt)
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

        if (realtimeResponse.ok) {
          const realtimeResult = await realtimeResponse.json();
          if (realtimeResult.success && realtimeResult.data && profileData) {
            const realtimeData = realtimeResult.data;
            const materialMountedAt = realtimeData.materialMountedAt;
            const todayDistance = realtimeData.totalDistanceToday || 0;
            const todayHours = realtimeData.currentHours || 0;

            console.log('📊 Real-time data:', {
              mountedAt: materialMountedAt,
              todayDistance,
              todayHours
            });

            // Step 2: If mountedAt exists, fetch historical data from mountedAt to yesterday
            if (materialMountedAt) {
              try {
                const mountedDate = new Date(materialMountedAt);
                mountedDate.setHours(0, 0, 0, 0);

                // Get yesterday (to exclude today, we'll add today's data separately)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(23, 59, 59, 999);

                // Only fetch historical if mountedAt is before today
                if (mountedDate < yesterday) {
                  const historicalUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}?period=daily&startDate=${mountedDate.toISOString()}&endDate=${yesterday.toISOString()}`;
                  
                  const historicalResponse = await fetch(historicalUrl, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                  });

                  if (historicalResponse.ok) {
                    const historicalResult = await historicalResponse.json();
                    if (historicalResult.success && historicalResult.data?.dailyData?.aggregatedMetrics) {
                      const historicalMetrics = historicalResult.data.dailyData.aggregatedMetrics;
                      
                      // TOTAL = Historical (mountedAt to yesterday) + Today
                      profileData.totalDistance = (historicalMetrics.totalDistance || 0) + todayDistance;
                      profileData.totalHours = (historicalMetrics.totalHours || 0) + todayHours;

                      console.log('✅ Total analytics calculated:', {
                        historicalDistance: historicalMetrics.totalDistance,
                        todayDistance,
                        totalDistance: profileData.totalDistance,
                        historicalHours: historicalMetrics.totalHours,
                        todayHours,
                        totalHours: profileData.totalHours
                      });
                    } else {
                      // No historical data, use only today's data
                      profileData.totalDistance = todayDistance;
                      profileData.totalHours = todayHours;
                      console.log('ℹ️ No historical data, using today only');
                    }
                  } else {
                    // Failed to fetch historical, use only today's data
                    profileData.totalDistance = todayDistance;
                    profileData.totalHours = todayHours;
                    console.log('⚠️ Historical fetch failed, using today only');
                  }
                } else {
                  // Mounted today, use only today's data
                  profileData.totalDistance = todayDistance;
                  profileData.totalHours = todayHours;
                  console.log('ℹ️ Material mounted today, using today only');
                }
              } catch (historicalError) {
                console.log('Error fetching historical data:', historicalError);
                // Fallback to today's data
                profileData.totalDistance = todayDistance;
                profileData.totalHours = todayHours;
              }
            } else {
              // No mountedAt, use only today's data
              profileData.totalDistance = todayDistance;
              profileData.totalHours = todayHours;
              console.log('⚠️ No mountedAt date, using today only');
            }
          }
        } else {
          console.log('⚠️ Analytics endpoint returned:', realtimeResponse.status);
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

    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        <Text style={styles.loadingText}>Loading profile...</Text>
        <View style={styles.loadingDotsContainer}>
          <View style={[styles.loadingDot, styles.loadingDot1]} />
          <View style={[styles.loadingDot, styles.loadingDot2]} />
          <View style={[styles.loadingDot, styles.loadingDot3]} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-circle-outline" size={64} color="#CCCCCC" />
        <Text style={styles.errorText}>Failed to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
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

                  {/* Materials Button */}
                  <TouchableOpacity 
                    style={styles.materialsActionButton} 
                  onPress={() => router.push('/materials')}
                >
                  <Ionicons name="cube-outline" size={20} color="#ffffff" />
                  <Text style={styles.materialsActionText}>View Assigned Material</Text>
                  <Ionicons name="chevron-forward" size={20} color="#ffffff" />
                </TouchableOpacity>

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
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={hasAnyPendingPhotos() ? "#999" : "#ffffff"} 
                    />
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
        <View style={styles.headerTop}>
          <View style={styles.profileAvatarContainer}>
            <Ionicons name="person-circle" size={70} color="#5b8ec5" />
            {profile.isOnline && <View style={styles.onlineIndicator} />}
          </View>
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
        </View>
        
        <Text style={styles.name}>
          {profile.firstName} {profile.lastName}
        </Text>
        <Text style={styles.driverId}>Driver ID: {profile.driverId}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="cash-outline" size={32} color="#4ade80" />
          </View>
          <Text style={styles.statValue}>₱ {realTotalEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="speedometer-outline" size={32} color="#3b82f6" />
          </View>
          <Text style={styles.statValue}>{profile.totalDistance.toFixed(1)} km</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="time-outline" size={32} color="#f59e0b" />
          </View>
          <Text style={styles.statValue}>{profile.totalHours.toFixed(1)} hours</Text>
          <Text style={styles.statLabel}>Hours</Text>
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
  loadingDotsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3674B5',
  },
  loadingDot1: {
    opacity: 0.3,
  },
  loadingDot2: {
    opacity: 0.6,
  },
  loadingDot3: {
    opacity: 1,
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
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
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  materialsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3674B5',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
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
    backgroundColor: '#0077CC',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 10,
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
