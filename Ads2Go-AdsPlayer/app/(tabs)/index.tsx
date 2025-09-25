import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView } from "react-native";
import * as Location from "expo-location";
import QRCode from "react-native-qrcode-svg";
import { router } from "expo-router/build/imperative-api";

import AsyncStorage from "@react-native-async-storage/async-storage";
import tabletRegistrationService, { TabletRegistration } from '../../services/tabletRegistration';
import deviceStatusService from '../../services/deviceStatusService';
import AdPlayer from '../../components/AdPlayer';
import DebugMaterialId from '../../debug-material-id';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {

  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registrationData, setRegistrationData] = useState<TabletRegistration | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unregistering, setUnregistering] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<string>('Not Started');
  const [isSimulatingOffline, setIsSimulatingOffline] = useState(false);
  const [showFullInterface, setShowFullInterface] = useState(true); // Start in full interface mode for debugging

  useEffect(() => {
    initializeApp();
    
    // Cleanup function to stop tracking when component unmounts
    return () => {
      if (isTracking) {
        console.log('Stopping location tracking on component unmount...');
        tabletRegistrationService.stopLocationTracking();
      }
      
      // Stop ad tracking simulation
      if ((window as any).adTrackingInterval) {
        clearInterval((window as any).adTrackingInterval);
        (window as any).adTrackingInterval = null;
      }
      
      // Cleanup device status service
      deviceStatusService.cleanup();
    };
  }, []);

  // Initialize device status service when registration data is available
  useEffect(() => {
    if (registrationData) {
      (deviceStatusService as any).initialize({
        materialId: registrationData.materialId,
        forceReconnect: false, // Don't force reconnect on initial load
        onStatusChange: (status: any) => {
          console.log('Device status changed:', status);
          setIsOnline(status.isOnline);
        }
      });
    }
  }, [registrationData]);

  // Refresh registration data when screen becomes active
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, refreshing registration data...');
      refreshRegistrationData();
    }, [])
  );

  const refreshRegistrationData = async () => {
    try {
      console.log('Refreshing registration data...');
      const registration = await tabletRegistrationService.getRegistrationData();
      console.log('Refreshed registration data:', registration);
      setRegistrationData(registration);
      
      // If we have registration data, update online status
      if (registration) {
        const online = await tabletRegistrationService.updateTabletStatus(true, {
          lat: location?.coords.latitude || 0,
          lng: location?.coords.longitude || 0
        });
        setIsOnline(online);
      }
    } catch (error) {
      console.error('Error refreshing registration data:', error);
    }
  };

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
        
        // Start continuous location tracking
        console.log('Starting continuous location tracking...');
        setTrackingStatus('Starting tracking...');
        
        try {
          await tabletRegistrationService.startLocationTracking();
          setIsTracking(true);
          setTrackingStatus('Active - Sending data every 30 seconds');
          console.log('Continuous location tracking started successfully');
        } catch (error) {
          console.error('Error starting continuous tracking:', error);
          setTrackingStatus('Error: Check server connection and permissions');
        }
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

  const handleStartTracking = async () => {
    try {
      console.log('Manually starting location tracking...');
      setTrackingStatus('Starting tracking...');
      
      await tabletRegistrationService.startLocationTracking();
      setIsTracking(true);
      setTrackingStatus('Active - Sending data every 30 seconds');
      console.log('Location tracking started manually');
      
      // Start ad tracking simulation
      startAdTrackingSimulation();
    } catch (error) {
      console.error('Error starting tracking:', error);
      setTrackingStatus('Error: Check server connection and permissions');
    }
  };

  const startAdTrackingSimulation = () => {
    // Simulate ad tracking every 30 seconds
    const adTrackingInterval = setInterval(async () => {
      if (!isTracking) {
        clearInterval(adTrackingInterval);
        return;
      }

      try {
        // Simulate different ads
        const ads = [
          { id: 'ad_001', title: 'McDonald\'s Big Mac', duration: 30 },
          { id: 'ad_002', title: 'Coca-Cola Refresh', duration: 25 },
          { id: 'ad_003', title: 'Nike Just Do It', duration: 35 },
          { id: 'ad_004', title: 'Samsung Galaxy', duration: 40 },
          { id: 'ad_005', title: 'Toyota Camry', duration: 45 }
        ];

        const randomAd = ads[Math.floor(Math.random() * ads.length)];
        const viewTime = Math.random() * randomAd.duration; // Random view time

        // Track ad playback
        await tabletRegistrationService.trackAdPlayback(
          randomAd.id,
          randomAd.title,
          randomAd.duration,
          viewTime
        );

        // Update driver activity
        await tabletRegistrationService.updateDriverActivity(true);

        console.log(`Ad tracked: ${randomAd.title} (${viewTime.toFixed(1)}s viewed)`);
      } catch (error) {
        console.error('Error in ad tracking simulation:', error);
      }
    }, 30000); // Every 30 seconds

    // Store interval ID for cleanup
    (window as any).adTrackingInterval = adTrackingInterval;
  };

  const handleStopTracking = async () => {
    try {
      console.log('Stopping location tracking...');
      await tabletRegistrationService.stopLocationTracking();
      setIsTracking(false);
      setTrackingStatus('Stopped');
      console.log('Location tracking stopped');
      
      // Stop ad tracking simulation
      if ((window as any).adTrackingInterval) {
        clearInterval((window as any).adTrackingInterval);
        (window as any).adTrackingInterval = null;
      }
    } catch (error) {
      console.error('Error stopping tracking:', error);
      setTrackingStatus('Error stopping tracking');
    }
  };

  const handleGoOffline = async () => {
    try {
      // Simulate offline
      setIsSimulatingOffline(true);
      setIsOnline(false);
      setTrackingStatus('Simulating Offline');
      
      // Set offline simulation flag in tablet registration service
      tabletRegistrationService.setSimulatingOffline(true);
      
      // Stop location tracking
      await tabletRegistrationService.stopLocationTracking();
      
      // Disconnect WebSocket connection
      (deviceStatusService as any).disconnect();
      
      // Send offline status to server
      if (registrationData) {
        await tabletRegistrationService.updateTabletStatus(false, { lat: 0, lng: 0 });
      }
      
      // Ad playback will be stopped by the AdPlayer component when isSimulatingOffline is true
      
      // Clear any existing location tracking state
      setIsTracking(false);
      
      console.log('Device simulation: Offline');
    } catch (error) {
      console.error('Error going offline:', error);
    }
  };

  const handleGoOnline = async () => {
    try {
      // Go back online
      setIsSimulatingOffline(false);
      setIsOnline(true);
      setTrackingStatus('Back Online');
      
      // Clear offline simulation flag in tablet registration service
      tabletRegistrationService.setSimulatingOffline(false);
      
      // Reconnect WebSocket connection
      if (registrationData) {
        (deviceStatusService as any).initialize({
          materialId: registrationData.materialId,
          forceReconnect: true, // Force reconnect when going back online
          onStatusChange: (status: any) => {
            console.log('Device status changed:', status);
            setIsOnline(status.isOnline);
          }
        });
      }
      
      // Don't automatically restart location tracking - let user control it
      // Location tracking will be started manually if needed
      
      // Send online status to server
      if (registrationData) {
        await tabletRegistrationService.updateTabletStatus(true, { lat: 0, lng: 0 });
      }
      
      // Ad playback will be restarted by the AdPlayer component when isSimulatingOffline is false
      
      console.log('Device simulation: Back online');
    } catch (error) {
      console.error('Error going online:', error);
    }
  };

  const handleReRegister = () => {
    Alert.alert(
      'Re-register Tablet',
      'This will unregister this tablet from the server and redirect you to the registration screen. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            setUnregistering(true);
            try {
              const result = await tabletRegistrationService.unregisterTablet();
              if (result.success) {
                // Clear local registration data, material ID, and cached ads before redirect
                await tabletRegistrationService.clearRegistration();
                await tabletRegistrationService.clearMaterialId();
                await tabletRegistrationService.clearAllCachedAds();
                
                Alert.alert(
                  'Success',
                  'Tablet unregistered successfully. You will be redirected to the registration screen.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Force refresh the app state before redirect
                        setRegistrationData(null);
                        // Add a small delay to ensure cleanup is complete
                        setTimeout(() => {
                          router.push('/registration?force=true');
                        }, 500);
                      }
                    }
                  ]
                );
              } else {
                // If server unregistration fails, offer to force unregister locally
                Alert.alert(
                  'Server Unavailable',
                  'Unable to unregister from server. Would you like to unregister locally and continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Force Unregister',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          const forceResult = await tabletRegistrationService.forceUnregisterTablet();
                          if (forceResult.success) {
                            // Clear local registration data, material ID, and cached ads before redirect
                            await tabletRegistrationService.clearRegistration();
                            await tabletRegistrationService.clearMaterialId();
                            await tabletRegistrationService.clearAllCachedAds();
                            
                            Alert.alert(
                              'Success',
                              'Tablet unregistered locally. You will be redirected to the registration screen.',
                              [
                                {
                                  text: 'OK',
                                  onPress: () => {
                                    // Force refresh the app state before redirect
                                    setRegistrationData(null);
                                    // Add a small delay to ensure cleanup is complete
                                    setTimeout(() => {
                                      router.push('/registration?force=true');
                                    }, 500);
                                  }
                                }
                              ]
                            );
                          } else {
                            Alert.alert('Error', forceResult.message);
                          }
                        } catch (error) {
                          Alert.alert('Error', 'Failed to unregister tablet locally.');
                        }
                      }
                    }
                  ]
                );
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to unregister tablet. Please try again.');
            } finally {
              setUnregistering(false);
            }
          }
        }
      ]
    );
  };

  const handleGoToRegistration = () => {
    router.push('/registration');
  };

  // Toggle between video-only and full interface mode
  const toggleInterfaceMode = () => {
    setShowFullInterface(prev => !prev);
  };


  const handleEmergencyUnregister = () => {
    Alert.alert(
      'Emergency Unregister',
      'This will clear the local registration data without contacting the server. Use this only if the server is completely unavailable. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Emergency Clear',
          style: 'destructive',
          onPress: async () => {
            setUnregistering(true);
            try {
              const result = await tabletRegistrationService.forceUnregisterTablet();
              if (result.success) {
                // Clear local registration data, material ID, and cached ads before redirect
                await tabletRegistrationService.clearRegistration();
                await tabletRegistrationService.clearMaterialId();
                await tabletRegistrationService.clearAllCachedAds();
                
                Alert.alert(
                  'Success',
                  'Local registration cleared. You will be redirected to the registration screen.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Force refresh the app state before redirect
                        setRegistrationData(null);
                        // Add a small delay to ensure cleanup is complete
                        setTimeout(() => {
                          router.push('/registration?force=true');
                        }, 500);
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Error', result.message);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to clear local registration.');
            } finally {
              setUnregistering(false);
            }
          }
        }
      ]
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

  // If not showing full interface, show only the video player
  if (!showFullInterface) {
    return (
      <View style={styles.videoOnlyContainer}>
        {registrationData ? (
          <AdPlayer
            materialId={registrationData.materialId}
            slotNumber={registrationData.slotNumber}
            isOffline={isSimulatingOffline}
            onAdError={(error) => {
              console.log('Ad Player Error:', error);
            }}
          />
        ) : (
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
        )}
        
        {/* Tap to show full interface - only visible after 10 taps */}
        <TouchableOpacity 
          style={styles.showInterfaceButton}
          onPress={toggleInterfaceMode}
        >
          <Text style={styles.showInterfaceText}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Advertisement Player</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefreshStatus}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? '🔄' : '🔄'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.videoModeButton}
            onPress={toggleInterfaceMode}
          >
            <Text style={styles.videoModeButtonText}>📺 Video Mode</Text>
          </TouchableOpacity>
        </View>
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

        {/* Tracking Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>🔄 Continuous Tracking</Text>
            <View style={[styles.statusIndicator, { backgroundColor: isTracking ? '#27ae60' : '#e74c3c' }]} />
          </View>
          <View style={styles.statusContent}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[styles.statusValue, { color: isTracking ? '#27ae60' : '#e74c3c' }]}>
                {isTracking ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Text style={styles.trackingStatusText}>
              {trackingStatus}
            </Text>
            <View style={styles.trackingControls}>
              {!isTracking ? (
                <TouchableOpacity 
                  style={[styles.trackingButton, styles.startButton]}
                  onPress={handleStartTracking}
                >
                  <Text style={styles.trackingButtonText}>▶️ Start Tracking</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.trackingButton, styles.stopButton]}
                  onPress={handleStopTracking}
                >
                  <Text style={styles.trackingButtonText}>⏹️ Stop Tracking</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[
                  styles.trackingButton, 
                  isSimulatingOffline ? styles.disabledButton : styles.offlineButton
                ]}
                onPress={handleGoOffline}
                disabled={isSimulatingOffline}
              >
                <Text style={[styles.trackingButtonText, isSimulatingOffline && styles.disabledButtonText]}>
                  🔴 Go Offline
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.trackingButton, 
                  !isSimulatingOffline ? styles.disabledButton : styles.onlineButton
                ]}
                onPress={handleGoOnline}
                disabled={!isSimulatingOffline}
              >
                <Text style={[styles.trackingButtonText, !isSimulatingOffline && styles.disabledButtonText]}>
                  🟢 Go Online
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Advertisement Player */}
      <View style={styles.adSection}>
        <Text style={styles.adTitle}>📺 Advertisement Player</Text>
        {registrationData ? (
          <AdPlayer
            materialId={registrationData.materialId}
            slotNumber={registrationData.slotNumber}
            isOffline={isSimulatingOffline}
            onAdError={(error) => {
              console.log('Ad Player Error:', error);
            }}
          />
        ) : (
          <View style={styles.notRegisteredContainer}>
            <Text style={styles.notRegisteredTitle}>
              Please register the tablet to start playing advertisements
            </Text>
          </View>
        )}
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
           disabled={unregistering}
         >
           {unregistering ? (
             <ActivityIndicator color="#fff" />
           ) : (
             <Text style={styles.actionButtonText}>🔄 Re-register Tablet</Text>
           )}
         </TouchableOpacity>
         
         <TouchableOpacity 
           style={[styles.actionButton, styles.emergencyButton]}
           onPress={handleEmergencyUnregister}
           disabled={unregistering}
         >
           <Text style={styles.actionButtonText}>🚨 Emergency Unregister</Text>
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  videoModeButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  videoModeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  videoOnlyContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  showInterfaceButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    zIndex: 1000,
  },
  showInterfaceText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  trackingStatusText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 4,
  },
  trackingControls: {
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  trackingButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#27ae60',
  },
  stopButton: {
    backgroundColor: '#e74c3c',
  },
  onlineButton: {
    backgroundColor: '#3498db',
  },
  offlineButton: {
    backgroundColor: '#e67e22',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.6,
  },
  trackingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#bdc3c7',
    opacity: 0.6,
  },
  adSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    minHeight: 400,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
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
    marginBottom: 12,
  },
  emergencyButton: {
    backgroundColor: '#f39c12',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
