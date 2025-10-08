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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import API_CONFIG from '../../config/api';

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

const GET_DRIVER_PROFILE = `
  query GetDriverProfile($driverId: ID!) {
    getDriverProfile(driverId: $driverId) {
      driverId
      firstName
      lastName
      email
      phoneNumber
      licenseNumber
      vehiclePlateNumber
      vehicleModel
      vehicleType
      isOnline
      totalEarnings
      totalDistance
      totalHours
      rating
      joinDate
      lastActive
    }
  }
`;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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

      if (result.data?.getDriverProfile) {
        setProfile(result.data.getDriverProfile);
      } else {
        // Fallback to stored driver info if API fails
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        if (driverInfo) {
          const driver = JSON.parse(driverInfo);
          setProfile({
            driverId: driver.driverId || driver.id || 'Unknown',
            firstName: driver.firstName || 'Driver',
            lastName: driver.lastName || '',
            email: driver.email || 'No email',
            phoneNumber: driver.phoneNumber || 'No phone',
            licenseNumber: driver.licenseNumber || 'No license',
            vehiclePlateNumber: driver.vehiclePlateNumber || 'Unknown',
            vehicleModel: driver.vehicleModel || 'Unknown',
            vehicleType: driver.vehicleType || 'Unknown',
            isOnline: false,
            totalEarnings: 0,
            totalDistance: 0,
            totalHours: 0,
            rating: 0,
            joinDate: new Date().toISOString(),
            lastActive: new Date().toISOString(),
          });
        }
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
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('driverId');
            await AsyncStorage.removeItem('driverInfo');
            // Navigation will be handled by the auth context
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
        <Text style={styles.loadingText}>Loading profile...</Text>
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

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileImageContainer}>
          <Ionicons name="person-circle" size={80} color="#3674B5" />
        </View>
        <Text style={styles.name}>
          {profile.firstName} {profile.lastName}
        </Text>
        <Text style={styles.driverId}>Driver ID: {profile.driverId}</Text>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: profile.isOnline ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {profile.isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="cash-outline" size={24} color="#22c55e" />
          <Text style={styles.statValue}>₱{profile.totalEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="speedometer-outline" size={24} color="#3b82f6" />
          <Text style={styles.statValue}>{profile.totalDistance.toFixed(1)} km</Text>
          <Text style={styles.statLabel}>Total Distance</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#f59e0b" />
          <Text style={styles.statValue}>{profile.totalHours.toFixed(1)}h</Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <TouchableOpacity 
          style={styles.materialsButton} 
          onPress={() => router.push('/(tabs)/index')}
        >
          <View style={styles.materialsButtonContent}>
            <View style={styles.materialsIconContainer}>
              <Ionicons name="cube-outline" size={24} color="#ffffff" />
            </View>
            <View style={styles.materialsTextContainer}>
              <Text style={styles.materialsButtonTitle}>Materials</Text>
              <Text style={styles.materialsButtonSubtitle}>View assigned materials and upload photos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Profile Information */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="mail-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile.email}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="call-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile.phoneNumber}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="card-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>License Number</Text>
            <Text style={styles.infoValue}>{profile.licenseNumber}</Text>
          </View>
        </View>
      </View>

      {/* Vehicle Information */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="car-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Plate Number</Text>
            <Text style={styles.infoValue}>{profile.vehiclePlateNumber}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="car-sport-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>{profile.vehicleModel}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="car-sport" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{profile.vehicleType}</Text>
          </View>
        </View>
      </View>

      {/* Account Information */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Joined</Text>
            <Text style={styles.infoValue}>{formatDate(profile.joinDate)}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={20} color="#6b7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Last Active</Text>
            <Text style={styles.infoValue}>{formatDate(profile.lastActive)}</Text>
          </View>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#f8fafc',
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
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  driverId: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  quickActionsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  materialsButton: {
    backgroundColor: '#3674B5',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  materialsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  materialsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  materialsTextContainer: {
    flex: 1,
  },
  materialsButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  materialsButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  infoSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 20,
  },
});
