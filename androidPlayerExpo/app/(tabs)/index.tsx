import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView } from "react-native";
import * as Location from "expo-location";
import { Video, ResizeMode } from "expo-av";
import QRCode from "react-native-qrcode-svg";


import AsyncStorage from "@react-native-async-storage/async-storage";
import tabletRegistrationService, { TabletRegistration } from '../../services/tabletRegistration';

export default function HomeScreen() {

  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registrationData, setRegistrationData] = useState<TabletRegistration | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Get location
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        await AsyncStorage.setItem("lastLocation", JSON.stringify(loc));
      }

      // Get registration data
      const registration = await tabletRegistrationService.getRegistrationData();
      setRegistrationData(registration);

      // Update online status
      if (registration) {
        const online = await tabletRegistrationService.updateTabletStatus(true, {
          lat: location?.coords.latitude || 0,
          lng: location?.coords.longitude || 0
        });
        setIsOnline(online);
      }

    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    await initializeApp();
    setRefreshing(false);
  };

  const handleReRegister = () => {
    Alert.alert(
      'Re-register Tablet',
      'This will clear the current registration and redirect you to the registration screen. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            await tabletRegistrationService.clearRegistration();
            console.log('Navigate to registration screen');
          }
        }
      ]
    );
  };

  const handleGoToRegistration = () => {
    // For now, just show an alert
    Alert.alert(
      'Registration',
      'Please manually navigate to the registration screen or restart the app.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Initializing tablet...</Text>
      </View>
    );
  }

  // If not registered, show registration prompt
  if (!registrationData) {
    return (
      <View style={styles.container}>
        <View style={styles.notRegisteredContainer}>
          <Text style={styles.notRegisteredTitle}>Tablet Not Registered</Text>
          <Text style={styles.notRegisteredSubtitle}>
            This tablet needs to be registered before it can display advertisements.
          </Text>
          
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={handleGoToRegistration}
          >
            <Text style={styles.registerButtonText}>🔗 Register Tablet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Advertisement Player</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefreshStatus}
          disabled={refreshing}
        >
          <Text style={styles.refreshButtonText}>
            {refreshing ? '🔄' : '🔄'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Cards */}
      <View style={styles.statusSection}>
        {/* Registration Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>📱 Tablet Status</Text>
            <View style={[styles.statusIndicator, { backgroundColor: isOnline ? '#27ae60' : '#e74c3c' }]} />
          </View>
          <View style={styles.statusContent}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[styles.statusValue, { color: isOnline ? '#27ae60' : '#e74c3c' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Material ID:</Text>
              <Text style={styles.statusValue}>{registrationData.materialId}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Slot Number:</Text>
              <Text style={styles.statusValue}>{registrationData.slotNumber}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Car Group ID:</Text>
              <Text style={styles.statusValue}>{registrationData.carGroupId}</Text>
            </View>
          </View>
        </View>

        {/* Location Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>📍 GPS Location</Text>
          <View style={styles.statusContent}>
            <Text style={styles.locationText}>
              {location ? 
                `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}` : 
                'Location not available'
              }
            </Text>
            <Text style={styles.locationTimestamp}>
              Last updated: {new Date().toLocaleTimeString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Advertisement Player */}
      <View style={styles.adSection}>
        <Text style={styles.adTitle}>📺 Advertisement Player</Text>
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: "https://www.w3schools.com/html/mov_bbb.mp4" }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
          />
        </View>
        <Text style={styles.adInfo}>
          Currently playing: Sample Advertisement
        </Text>
      </View>

      {/* Tablet QR Code */}
      <View style={styles.qrSection}>
        <Text style={styles.qrTitle}>📱 This Tablet's QR Code</Text>
        <Text style={styles.qrSubtitle}>
          Scan this code to get this tablet's registration details
        </Text>
        <View style={styles.qrContainer}>
          <QRCode 
            value={JSON.stringify({
              deviceId: registrationData.deviceId,
              materialId: registrationData.materialId,
              slotNumber: registrationData.slotNumber,
              carGroupId: registrationData.carGroupId
            })} 
            size={200} 
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleReRegister}
        >
          <Text style={styles.actionButtonText}>🔄 Re-register Tablet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  notRegisteredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notRegisteredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  notRegisteredSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  registerButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  statusSection: {
    padding: 20,
    gap: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusContent: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  locationText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    marginBottom: 4,
  },
  locationTimestamp: {
    fontSize: 12,
    color: '#95a5a6',
  },
  adSection: {
    padding: 20,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  videoContainer: {
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  video: {
    width: '100%',
    height: 200,
  },
  adInfo: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  qrSection: {
    padding: 20,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  actionSection: {
    padding: 20,
  },
  actionButton: {
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
