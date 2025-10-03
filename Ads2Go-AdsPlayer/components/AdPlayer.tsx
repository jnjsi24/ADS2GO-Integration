import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, StatusBar, Platform } from 'react-native';
// Using expo-av for compatibility with Expo SDK 49
// TODO: Migrate to expo-video when upgrading to Expo SDK 54+
import { Video, ResizeMode } from 'expo-av';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import tabletRegistrationService from '../services/tabletRegistration';
import playbackWebSocketService from '../services/playbackWebSocketService';
import companyAdService, { CompanyAd } from '../services/companyAdService';
import offlineQueueService from '../services/offlineQueueService';

// API Base URL - should match the one in tabletRegistration service
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Suppress expo-av deprecation warning
const originalWarn = console.warn;
console.warn = function filterWarnings(...args: any[]) {
  const warning = args[0];
  if (typeof warning === 'string' && warning.includes('expo-av') && warning.includes('deprecated')) {
    return;
  }
  originalWarn.apply(console, args);
};
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Ad } from '../services/tabletRegistration';

interface AdPlayerProps {
  materialId: string;
  slotNumber: number;
  onAdError?: (error: string) => void;
  isOffline?: boolean;
}

const AdPlayer: React.FC<AdPlayerProps> = ({ materialId, slotNumber, onAdError, isOffline = false }) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [companyAds, setCompanyAds] = useState<CompanyAd[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<boolean>(true);
  const [adStartTime, setAdStartTime] = useState<Date | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [showControls, setShowControls] = useState(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [websocketUpdatesStarted, setWebsocketUpdatesStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [qrCodeReady, setQrCodeReady] = useState(false);
  const [videoActuallyStarted, setVideoActuallyStarted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncData, setSyncData] = useState<any>(null);
  const videoRef = useRef<Video>(null);

  // Cache key for storing ads locally
  const getCacheKey = () => `ads_${materialId}_${slotNumber}`;

  // Check registration status on mount
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const registered = await tabletRegistrationService.checkRegistrationStatus();
        setIsRegistered(registered);
        if (!registered) {
          setError('Device not registered. Please register the tablet first.');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking registration status:', error);
        setError('Failed to verify registration status');
        setLoading(false);
      }
    };
    
    checkRegistration();
  }, []);

  // Setup WebSocket synchronization
  useEffect(() => {
    if (isRegistered) {
      // Set up slot synchronization callback
      playbackWebSocketService.setSlotSyncCallback(handleSlotSync);
      
      // Connect to WebSocket
      playbackWebSocketService.connect().then((connected) => {
        if (connected) {
          // Start periodic sync requests for late-connecting devices
          playbackWebSocketService.startPeriodicSync();
          
          // Request initial synchronization after a delay to allow ads to start
          setTimeout(() => {
            playbackWebSocketService.requestSync();
          }, 5000); // Wait 5 seconds before first sync request
        }
      });
    }

    return () => {
      playbackWebSocketService.setSlotSyncCallback(() => {});
      playbackWebSocketService.stopPeriodicSync();
    };
  }, [isRegistered]);

  // Handle slot synchronization messages
  const handleSlotSync = (message: any) => {
    console.log('🔄 [AdPlayer] Received slot sync:', message);
    
    if (message.sourceSlot !== slotNumber) {
      setSyncData(message);
      setIsSyncing(true);
      
      // Only sync if we're not currently playing or if the other slot is playing a different ad
      if (message.state === 'playing' && message.adId) {
        // Only sync to a different ad if we're not currently playing anything
        if (!currentAd || message.adId !== currentAd.adId) {
          console.log(`🔄 [AdPlayer] Syncing to playing ad: ${message.adTitle} at ${message.currentTime}s`);
          syncToAd(message);
        } else {
          // Same ad, just sync position
          console.log(`🔄 [AdPlayer] Syncing position for same ad: ${message.adTitle}`);
          if (videoRef.current && message.currentTime) {
            const seekTime = message.currentTime * 1000;
            videoRef.current.setPositionAsync(seekTime);
          }
          setIsSyncing(false);
        }
      } else if (message.state === 'paused') {
        console.log(`🔄 [AdPlayer] Syncing to paused state`);
        // Pause current playback to match other slot
        if (videoRef.current) {
          videoRef.current.pauseAsync();
        }
        setIsSyncing(false);
      } else if (message.state === 'loading' || message.state === 'buffering') {
        console.log(`🔄 [AdPlayer] Syncing to loading/buffering state`);
        // Don't interrupt current playback for loading states
        setIsSyncing(false);
      }
    }
  };

  // Sync to a specific ad from another slot
  const syncToAd = async (syncMessage: any) => {
    try {
      console.log('🔄 [AdPlayer] Syncing to ad:', syncMessage.adTitle);
      
      // Find the ad in our current ads list
      const adIndex = ads.findIndex(ad => ad.adId === syncMessage.adId);
      
      if (adIndex !== -1) {
        console.log(`🔄 [AdPlayer] Found ad at index ${adIndex}, switching to it`);
        
        // Stop current playback
        if (videoRef.current) {
          try {
            await videoRef.current.pauseAsync();
          } catch (error) {
            console.log('Error pausing video during sync:', error);
          }
        }
        
        // Switch to the synced ad
        setCurrentAdIndex(adIndex);
        
        // Wait a moment for the ad to load, then sync position
        setTimeout(async () => {
          try {
            if (videoRef.current && syncMessage.currentTime) {
              const seekTime = syncMessage.currentTime * 1000; // Convert to milliseconds
              console.log(`🔄 [AdPlayer] Seeking to position: ${syncMessage.currentTime}s`);
              
              await videoRef.current.setPositionAsync(seekTime);
              
              // Start playing if the source is playing
              if (syncMessage.state === 'playing') {
                console.log(`🔄 [AdPlayer] Starting playback to match source`);
                await videoRef.current.playAsync();
              }
            }
          } catch (error) {
            console.error('Error during position sync:', error);
          }
        }, 1500); // Wait 1.5 seconds for the video to load
        
        // Also send a sync confirmation back
        if (syncMessage.state === 'playing') {
          setTimeout(() => {
            playbackWebSocketService.updatePlaybackDataAndSend({
              adId: syncMessage.adId,
              adTitle: syncMessage.adTitle,
              state: 'playing',
              currentTime: syncMessage.currentTime || 0,
              duration: syncMessage.duration || 0,
              progress: syncMessage.progress || 0,
            });
          }, 2000);
        }
      } else {
        console.log('⚠️ [AdPlayer] Synced ad not found in current ads list, available ads:', ads.map(ad => ad.adTitle));
        
        // If we don't have the ad yet, try to fetch ads again
        if (ads.length === 0) {
          console.log('🔄 [AdPlayer] No ads loaded, attempting to fetch ads...');
          // This will trigger the ad fetching logic
          setLoading(true);
        }
      }
    } catch (error) {
      console.error('Error syncing to ad:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Track ad playback
  const trackAdPlayback = async (adId: string, adTitle: string, adDuration: number, viewTime: number = 0) => {
    try {
      console.log(`🎬 Tracking ad playback: ${adTitle} (${adDuration}s) - View time: ${viewTime}s - ${isOffline ? 'OFFLINE' : 'ONLINE'}`);
      
      // If this is a company ad, increment play count
      if (currentAdIndex === -1 && companyAds.length > 0) {
        console.log(`🏢 Tracking company ad play count: ${adTitle}`);
        await companyAdService.incrementPlayCount(adId);
      }
      
      // Get registration data for analytics
      const registrationData = await tabletRegistrationService.getRegistrationData();
      
      // Create ad playback data for queuing
      const adPlaybackData = {
        adId: adId,
        adTitle: adTitle,
        adDuration: adDuration,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        viewTime: viewTime,
        completionRate: viewTime && adDuration ? Math.round((viewTime / adDuration) * 100) : 100,
        impressions: 1,
        slotNumber: slotNumber
      };

      // Queue the ad playback data (will send immediately if online, queue if offline)
      await offlineQueueService.queueAdPlayback(adPlaybackData);
      
      // Send to analytics service
      const analyticsData = {
        deviceId: registrationData?.deviceId || await tabletRegistrationService.generateDeviceId(),
        deviceSlot: slotNumber, // Server expects 'deviceSlot' not 'slotNumber'
        adId: adId,
        adTitle: adTitle,
        adDuration: adDuration,
        viewTime: viewTime // Use actual view time instead of 0
      };
      
      // Send to analytics endpoint (only if online)
      if (!isOffline) {
        try {
          const analyticsResponse = await fetch(`${API_BASE_URL}/deviceTracking/ad-playback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(analyticsData),
          });
          
          if (analyticsResponse.ok) {
            console.log(`✅ Ad playback tracked in analytics: ${adTitle}`);
          } else {
            console.log(`❌ Failed to track ad playback in analytics: ${adTitle}`);
          }
        } catch (error) {
          console.error('❌ Error sending analytics data:', error);
        }
      }
      
      // Also send to existing screen tracking (start of ad playback)
      if (!isOffline) {
        try {
          const success = await tabletRegistrationService.trackAdPlayback(adId, adTitle, adDuration, 0);
          if (success) {
            console.log(`✅ Ad playback tracked successfully: ${adTitle}`);
          } else {
            console.log(`❌ Failed to track ad playback: ${adTitle}`);
          }
        } catch (error) {
          console.error('❌ Error sending to tablet registration service:', error);
        }
      }
    } catch (error) {
      console.error('Error tracking ad playback:', error);
    }
  };

  // Track QR code scan with GPS and device data
  const trackQRScan = async (adId: string, adTitle: string) => {
    try {
      if (isOffline) {
        console.log(`Skipping QR scan tracking - device is offline: ${adTitle}`);
        return;
      }
      
      console.log(`📱 Tracking QR scan: ${adTitle}`);
      console.log(`📱 Current ad data:`, {
        adId: currentAd?.adId,
        adTitle: currentAd?.adTitle,
        website: (currentAd as any)?.website,
        materialId,
        slotNumber
      });
      
      // Get current GPS location
      let gpsData = null;
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 1,
        });
        gpsData = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          speed: location.coords.speed || 0,
          heading: location.coords.heading || 0,
          accuracy: location.coords.accuracy || 0,
          altitude: location.coords.altitude || 0
        };
        console.log('GPS data for QR scan:', gpsData);
      } catch (locationError) {
        console.warn('Could not get GPS location for QR scan:', locationError);
      }

      // Get device information
      const rawDeviceType = Device.deviceType;
      // Handle both string and number types
      const deviceTypeNum = typeof rawDeviceType === 'string' ? parseInt(rawDeviceType) : rawDeviceType;
      const mappedDeviceType = deviceTypeNum === 2 ? 'tablet' : deviceTypeNum === 1 ? 'mobile' : 'unknown';
      
      console.log('🔧 QR Scan Device Type Mapping:', {
        raw: rawDeviceType,
        parsed: deviceTypeNum,
        mapped: mappedDeviceType,
        type: typeof rawDeviceType
      });
      
      // Force device type to tablet for testing
      const finalDeviceType = 'tablet';
      console.log('🔧 FORCED Device Type:', finalDeviceType);
      console.log('🔧 DEVICE TYPE DEBUG - Raw:', rawDeviceType, 'Type:', typeof rawDeviceType);
      
      const deviceInfo = {
        deviceId: await tabletRegistrationService.generateDeviceId(),
        deviceName: Device.deviceName || 'Unknown',
        deviceType: finalDeviceType,
        osName: Device.osName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS || 'Unknown',
        brand: Device.brand || 'Unknown',
        modelName: Device.modelName || 'Unknown'
      };

      // Get registration data
      const registrationData = await tabletRegistrationService.getRegistrationData();
      
      // Generate QR data first
      const qrData = generateQRData();
      
      // Calculate the correct slot number for this ad
      const adSlotNumber = currentAdIndex === -1 ? 1 : currentAdIndex + 1;
      
      // Send QR scan data to server with GPS and device info
      const qrScanData = {
        adId,
        adTitle,
        materialId: materialId || 'unknown',
        slotNumber: adSlotNumber,
        timestamp: new Date().toISOString(),
        qrCodeUrl: qrData, // The QR code URL
        website: (currentAd as any)?.website || null, // Include advertiser website
        redirectUrl: qrData, // The actual URL the QR code points to (same as qrCodeUrl)
        deviceInfo,
        gpsData,
        registrationData: registrationData ? {
          deviceId: registrationData.deviceId,
          carGroupId: registrationData.carGroupId,
          isRegistered: registrationData.isRegistered
        } : null,
        networkStatus,
        isOffline,
        screenData: {
          width: screenData.width,
          height: screenData.height,
          scale: screenData.scale
        }
      };

      // Enhanced QR scan logging
      console.log('\n🚨 ANDROID APP: QR SCAN INITIATED 🚨');
      console.log('=====================================');
      console.log(`📱 Ad: ${adTitle} (${adId})`);
      console.log(`🏷️  Material: ${materialId} - Slot: ${slotNumber}`);
      console.log(`🌐 QR URL: ${qrData}`);
      console.log(`📱 Device: ${deviceInfo.deviceId}`);
      console.log(`⏰ Time: ${new Date().toLocaleString()}`);
      console.log('=====================================\n');
      
      console.log('📤 QR scan data to send:', qrScanData);
      console.log('📤 Website in QR scan data:', qrScanData.website);
      console.log('📤 Redirect URL in QR scan data:', qrScanData.redirectUrl);

      // Send to QR scan tracking endpoint
      const response = await fetch(`${API_BASE_URL}/ads/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(qrScanData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('\n🎉 ANDROID APP: QR SCAN SUCCESS! 🎉');
        console.log('=====================================');
        console.log(`✅ Ad: ${adTitle}`);
        console.log(`✅ Material: ${materialId} - Slot: ${slotNumber}`);
        console.log(`✅ Device: ${deviceInfo.deviceId}`);
        console.log(`✅ Time: ${new Date().toLocaleString()}`);
        console.log('=====================================\n');
        console.log('📊 Server Response:', result);
      } else {
        console.error('\n❌ ANDROID APP: QR SCAN FAILED! ❌');
        console.error('=====================================');
        console.error(`❌ Ad: ${adTitle}`);
        console.error(`❌ Status: ${response.status} ${response.statusText}`);
        console.error(`❌ Time: ${new Date().toLocaleString()}`);
        console.error('=====================================\n');
      }
      
      // QR scan is already tracked in the /ads/qr-scan endpoint above
      // No need for duplicate analytics call - everything is handled in analytics collection
      console.log(`✅ QR scan fully tracked via /ads/qr-scan endpoint: ${adTitle}`);
    } catch (error) {
      console.error('Error tracking QR scan:', error);
    }
  };

  // Track QR code display (when QR code is shown to user)
  const trackQRDisplay = async (adId: string, adTitle: string) => {
    try {
      if (isOffline) {
        console.log(`Skipping QR display tracking - device is offline: ${adTitle}`);
        return;
      }
      
      console.log(`📱 Tracking QR code display: ${adTitle}`);
      
      // Get current GPS location
      let gpsData = null;
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 1,
        });
        gpsData = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          speed: location.coords.speed || 0,
          heading: location.coords.heading || 0,
          accuracy: location.coords.accuracy || 0,
          altitude: location.coords.altitude || 0
        };
        console.log('GPS data for QR display:', gpsData);
      } catch (locationError) {
        console.warn('Could not get GPS location for QR display:', locationError);
      }

      // Get device information
      const rawDeviceType = Device.deviceType;
      // Handle both string and number types
      const deviceTypeNum = typeof rawDeviceType === 'string' ? parseInt(rawDeviceType) : rawDeviceType;
      const mappedDeviceType = deviceTypeNum === 2 ? 'tablet' : deviceTypeNum === 1 ? 'mobile' : 'unknown';
      
      console.log('🔧 QR Display Device Type Mapping:', {
        raw: rawDeviceType,
        parsed: deviceTypeNum,
        mapped: mappedDeviceType,
        type: typeof rawDeviceType
      });
      
      // Force device type to tablet for testing
      const finalDeviceType = 'tablet';
      console.log('🔧 FORCED Display Device Type:', finalDeviceType);
      console.log('🔧 DISPLAY DEVICE TYPE DEBUG - Raw:', rawDeviceType, 'Type:', typeof rawDeviceType);
      
      const deviceInfo = {
        deviceId: await tabletRegistrationService.generateDeviceId(),
        deviceName: Device.deviceName || 'Unknown',
        deviceType: finalDeviceType,
        osName: Device.osName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS || 'Unknown',
        brand: Device.brand || 'Unknown',
        modelName: Device.modelName || 'Unknown'
      };

      // Get registration data
      const registrationData = await tabletRegistrationService.getRegistrationData();
      
      // Calculate the correct slot number for this ad
      const adSlotNumber = currentAdIndex === -1 ? 1 : currentAdIndex + 1;
      
      // Send QR display data to server
      const qrDisplayData = {
        adId,
        adTitle,
        materialId: materialId || 'unknown',
        slotNumber: adSlotNumber,
        timestamp: new Date().toISOString(),
        qrCodeUrl: generateQRData(),
        userAgent: 'Android App - QR Display',
        deviceInfo,
        gpsData,
        registrationData: registrationData ? {
          deviceId: registrationData.deviceId,
          carGroupId: registrationData.carGroupId,
          isRegistered: registrationData.isRegistered
        } : null,
        networkStatus,
        isOffline,
        screenData: {
          width: screenData.width,
          height: screenData.height,
          scale: screenData.scale
        }
      };

      console.log('QR display data to send:', qrDisplayData);

      // Send to device tracking endpoint (new daily staging system)
      const deviceTrackingResponse = await fetch(`${API_BASE_URL}/deviceTracking/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: registrationData?.deviceId || await tabletRegistrationService.generateDeviceId(),
          deviceSlot: adSlotNumber,
          qrScanData: qrDisplayData
        }),
      });

      if (deviceTrackingResponse.ok) {
        console.log(`✅ QR display tracked in device tracking: ${adTitle}`);
      } else {
        console.log(`❌ Failed to track QR display in device tracking: ${adTitle}`);
      }

      // Also send to existing QR scan tracking endpoint for backward compatibility
      const response = await fetch(`${API_BASE_URL}/ads/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(qrDisplayData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ QR display tracked successfully: ${adTitle}`, result);
      } else {
        console.error(`❌ Failed to track QR display: ${response.status} ${response.statusText}`);
      }
      
      console.log(`✅ QR display fully tracked via both endpoints: ${adTitle}`);
    } catch (error) {
      console.error('Error tracking QR display:', error);
    }
  };

  // Track QR code display when ad changes (only once per ad)
  const [trackedAds, setTrackedAds] = useState(new Set());
  
  // Determine which ad to show
  const currentAd = currentAdIndex === -1 ? 
    (companyAds.length > 0 ? {
      adId: companyAds[0].id,
      adTitle: companyAds[0].title,
      mediaFile: companyAds[0].mediaFile,
      duration: companyAds[0].duration
    } : null) : 
    (ads[currentAdIndex] || null);
  
  useEffect(() => {
    if (currentAd && currentAdIndex >= 0 && !isOffline && !trackedAds.has(currentAd.adId)) {
      // Note: QR display tracking is now handled by the tracking page when users scan
      console.log(`📱 QR code displayed for ad: ${currentAd.adTitle}`);
      setTrackedAds(prev => new Set(prev).add(currentAd.adId));
    }
  }, [currentAd?.adId, currentAdIndex, isOffline, trackedAds]);

  // Handle QR code interaction (for debugging - simulates when someone scans the QR code)
  const handleQRInteraction = () => {
    if (currentAd) {
      console.log(`🔍 DEBUG: Simulating QR code scan for ad: ${currentAd.adTitle}`);
      console.log(`🔍 Ad ID: ${currentAd.adId}`);
      console.log(`🔍 Material ID: ${materialId}`);
      console.log(`🔍 Slot Number: ${slotNumber}`);
      console.log(`🔍 Website: ${(currentAd as any).website}`);
      console.log(`🔍 QR URL: ${generateQRData()}`);
      
      // Note: QR scan tracking is now handled by the tracking page, not the Android app
      console.log('🔍 QR scan will be tracked when user visits the tracking URL');
    } else {
      console.log('🔍 DEBUG: No current ad available for QR scan simulation');
    }
  };


  // Handle screen tap to show controls and debug info
  const handleScreenTap = () => {
    const currentTime = Date.now();
    
    // Reset tap count if more than 3 seconds have passed since last tap
    if (currentTime - lastTapTime > 3000) {
      setTapCount(1);
    } else {
      setTapCount(prev => prev + 1);
    }
    
    setLastTapTime(currentTime);
    
    // Show debug info and controls after 10 taps
    if (tapCount >= 9) { // 9 because we increment after this check
      setShowDebugInfo(true);
      setShowControls(true);
      console.log('Debug info and controls activated after 10 taps');
    }
    
    // Reset tap count after 5 seconds of inactivity
    setTimeout(() => {
      setTapCount(0);
    }, 5000);
  };

  // State for QR code data - generated asynchronously to not block video
  const [qrData, setQrData] = useState<string | null>(null);

  // Generate QR code data asynchronously to prevent blocking video playback
  useEffect(() => {
    if (!currentAd) {
      setQrData(null);
      setQrCodeReady(false);
      return;
    }

    // Generate QR data asynchronously using setTimeout to prevent blocking
    const generateQRAsync = () => {
      // Calculate the correct slot number for this ad
      const adSlotNumber = currentAdIndex === -1 ? 1 : currentAdIndex + 1;
      
      console.log('🔍 Generating QR data for ad:', {
        adId: currentAd.adId,
        adTitle: currentAd.adTitle,
        website: (currentAd as any).website,
        hasWebsite: !!(currentAd as any).website,
        adSlotNumber: adSlotNumber,
        currentAdIndex: currentAdIndex
      });
      
      // Use the tracking server to track QR scans
      const trackingUrl = `${API_BASE_URL}/qr-track.html?` + new URLSearchParams({
        ad_id: currentAd.adId,
        ad_title: currentAd.adTitle || `Ad ${currentAd.adId}`,
        material_id: materialId,
        slot_number: adSlotNumber.toString(),
        website: (currentAd as any).website || 'https://ads2go.app',
        redirect_url: (currentAd as any).website || 'https://ads2go.app',
        scan_time: Date.now().toString()
      }).toString();
      
      console.log('🔍 Using tracking URL:', trackingUrl);
      
      // Set QR data and mark as ready
      setQrData(trackingUrl);
      setQrCodeReady(true);
    };

    // Use setTimeout to make QR generation non-blocking
    const timeoutId = setTimeout(generateQRAsync, 0);
    
    return () => clearTimeout(timeoutId);
  }, [currentAd?.adId, currentAd?.adTitle, currentAdIndex, materialId]);

  // Generate QR code data for current ad (legacy function for compatibility)
  const generateQRData = () => {
    return qrData;
  };

  // Generate QR code data for tracking (separate from the URL)
  const generateQRTrackingData = () => {
    if (!currentAd) return null;
    
    const qrData = {
      type: 'ad_scan',
      adId: currentAd.adId,
      adTitle: currentAd.adTitle,
      materialId: materialId,
      slotNumber: slotNumber,
      website: (currentAd as any).website || null,
      redirectUrl: generateQRData(), // The actual URL the QR code points to
      timestamp: new Date().toISOString(),
      action: 'scan'
    };
    
    return JSON.stringify(qrData);
  };

  // End ad playback tracking
  const endAdPlayback = async () => {
    try {
      if (adStartTime && currentAd) {
        const viewTime = (Date.now() - adStartTime.getTime()) / 1000; // in seconds
        console.log(`🏁 Ending ad playback: ${currentAd.adTitle} (viewed for ${viewTime.toFixed(1)}s)`);
        await tabletRegistrationService.trackAdPlayback(
          currentAd.adId,
          currentAd.adTitle,
          currentAd.duration,
          viewTime
        );
      }
    } catch (error) {
      console.error('Error ending ad playback:', error);
    }
  };

  // Check network connectivity
  const checkNetworkStatus = async () => {
    try {
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected && state.isInternetReachable;
      setNetworkStatus(isConnected || false);
      return isConnected;
    } catch (err) {
      console.error('Error checking network status:', err);
      // Fallback: assume we're online and let the fetch attempt determine connectivity
      return true;
    }
  };

  // Load cached ads from local storage
  const loadCachedAds = async () => {
    try {
      const cacheKey = getCacheKey();
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedAds = JSON.parse(cachedData);
        
        // Validate cached ads as well
        const validCachedAds = await filterValidAds(parsedAds);
        
        if (validCachedAds.length > 0) {
          setAds(validCachedAds);
          setCurrentAdIndex(0);
          console.log('Loaded valid cached ads:', validCachedAds.length);
          return true;
        } else {
          console.log('No valid cached ads found, clearing cache');
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (err) {
      console.error('Error loading cached ads:', err);
    }
    return false;
  };

  // Save ads to local storage
  const saveAdsToCache = async (adsToCache: Ad[]) => {
    try {
      const cacheKey = getCacheKey();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(adsToCache));
      console.log('Saved ads to cache:', adsToCache.length);
    } catch (err) {
      console.error('Error saving ads to cache:', err);
    }
  };

  // Check if we have cached ads available
  const hasCachedAds = () => {
    return ads.length > 0;
  };

  // Validate video URL before attempting playback
  const validateVideoUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.log('Video URL validation failed:', url, error);
      return false;
    }
  };

  // Filter out invalid ads
  const filterValidAds = async (adsToFilter: Ad[]): Promise<Ad[]> => {
    const validAds: Ad[] = [];
    
    for (const ad of adsToFilter) {
      if (ad.mediaFile && ad.mediaFile.trim() !== '') {
        const isValid = await validateVideoUrl(ad.mediaFile);
        if (isValid) {
          validAds.push(ad);
        } else {
          console.log('Skipping invalid video URL:', ad.mediaFile);
        }
      }
    }
    
    console.log(`Filtered ${adsToFilter.length} ads to ${validAds.length} valid ads`);
    return validAds;
  };

  // Fetch company ads
  const fetchCompanyAds = async () => {
    try {
      console.log('🏢 Fetching company ads...');
      const result = await companyAdService.fetchActiveCompanyAds();
      
      if (result.success && result.ads.length > 0) {
        setCompanyAds(result.ads);
        console.log(`✅ Loaded ${result.ads.length} company ads`);
      } else {
        console.log('⚠️ No company ads available:', result.message);
        setCompanyAds([]);
      }
    } catch (error) {
      console.error('❌ Error fetching company ads:', error);
      setCompanyAds([]);
    }
  };

  // Import the service dynamically to avoid circular dependencies
  const fetchAds = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsDeviceOffline(false);
      
      // Check network status first
      const isConnected = await checkNetworkStatus();
      if (!isConnected) {
        console.log('Network is offline, loading cached ads');
        const hasCached = await loadCachedAds();
        if (hasCached) {
          setIsDeviceOffline(true);
          setWebsocketUpdatesStarted(false); // Reset flag for cached ads
          setLoading(false);
          return;
        } else {
          setError('No internet connection and no cached ads available');
          setLoading(false);
          return;
        }
      }
      
      const { default: tabletRegistrationService } = await import('../services/tabletRegistration');
      const result = await tabletRegistrationService.fetchAds(materialId, slotNumber);
      
      if (result.success && result.ads.length > 0) {
        // Filter out invalid ads before setting state
        const validAds = await filterValidAds(result.ads);
        
        if (validAds.length > 0) {
          setAds(validAds);
          setCurrentAdIndex(0);
          setWebsocketUpdatesStarted(false); // Reset flag for new ads
          console.log('Loaded valid ads from server:', validAds.length);
          
          // Cache the valid ads for offline use
          await saveAdsToCache(validAds);
        } else {
          console.log('No valid ads found after filtering');
          // Try to load cached ads if server has no valid ads
          const hasCached = await loadCachedAds();
          if (!hasCached) {
            setError('No valid ads available');
            if (onAdError) {
              onAdError('No valid ads available');
            }
          }
        }
      } else {
        // Try to load cached ads if server has no ads
        const hasCached = await loadCachedAds();
        if (!hasCached) {
          setError(result.message || 'No ads available');
          if (onAdError) {
            onAdError(result.message || 'No ads available');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching ads from server:', err);
      
      // Network error - try to load cached ads
      const hasCached = await loadCachedAds();
      if (hasCached) {
        setIsDeviceOffline(true);
        console.log('Using cached ads in offline mode');
      } else {
        const errorMessage = 'Failed to fetch ads and no cached ads available';
        setError(errorMessage);
        if (onAdError) {
          onAdError(errorMessage);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Monitor network status changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      setNetworkStatus(isConnected || false);
      
      // If we regain connection and we're in offline mode, try to refresh
      if (isConnected && isOffline) {
        console.log('Network restored, attempting to refresh ads');
        fetchAds();
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  useEffect(() => {
    // Only fetch ads if device is registered
    if (isRegistered === false) {
      return; // Don't fetch ads if not registered
    }
    
    if (isRegistered === null) {
      return; // Still checking registration status
    }
    
    // Fetch both user ads and company ads
    const fetchAllAds = async () => {
      await Promise.all([
        fetchAds(),
        fetchCompanyAds()
      ]);
    };
    
    fetchAllAds();
    
    // Connect to WebSocket for real-time playback updates
    playbackWebSocketService.connect().then((connected) => {
      if (connected) {
        console.log('🔌 [AdPlayer] WebSocket connected for real-time updates');
      } else {
        console.log('🔌 [AdPlayer] WebSocket connection failed');
      }
    });
    
    // Cleanup WebSocket on unmount
    return () => {
      playbackWebSocketService.disconnect();
    };
  }, [materialId, slotNumber, isRegistered]);

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

  // Company ad data (Ads2Go branding)
  // Track ad playback when current ad changes
  useEffect(() => {
    if (currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad') {
      console.log(`🎬 Starting ad playback tracking: ${currentAd.adTitle}`);
      setAdStartTime(new Date());
      trackAdPlayback(currentAd.adId, currentAd.adTitle, currentAd.duration, 0); // Start of ad playback
      
      // Reset WebSocket updates for new ad
      setWebsocketUpdatesStarted(false);
      setVideoActuallyStarted(false);
      
      // Reset retry count for new ad
      setRetryCount(0);
      
      // DON'T send any WebSocket updates yet - wait for video to actually load
      // The onLoadStart, onLoad, and onReadyForDisplay will handle the buffering states
      console.log(`🎬 [AdPlayer] New ad loaded: ${currentAd.adTitle} - waiting for video to load before sending WebSocket updates`);
    }
  }, [currentAdIndex, currentAd?.adTitle, currentAd?.adId]);

  // Stop video playback when going offline
  useEffect(() => {
    if (isOffline && videoRef.current) {
      console.log('Stopping video playback - device is offline');
      videoRef.current.pauseAsync();
      setIsPlaying(false);
    }
  }, [isOffline]);

  // Debug logging
  console.log('Current ad:', {
    currentAdIndex,
    isCompanyAd: currentAdIndex === -1,
    adTitle: currentAd?.adTitle || 'No ad',
    adId: currentAd?.adId || 'No ID',
    duration: currentAd?.duration || 0,
    mediaFile: currentAd?.mediaFile || 'No media',
    totalAds: ads.length,
    isOffline,
    networkStatus,
    adStartTime: adStartTime ? 'Set' : 'Not set'
  });

  const handleVideoEnd = async () => {
    // End tracking for current ad
    await endAdPlayback();
    
    // Stop WebSocket updates completely
    playbackWebSocketService.stopPlaybackUpdates();
    
    // Set transitioning state to prevent false progress
    setIsTransitioning(true);
    
    // Reset ad start time for next ad
    setAdStartTime(null);
    
    // Reset WebSocket updates flag for next ad
    setWebsocketUpdatesStarted(false);
    
    // If no user ads available, loop the company ad
    if (ads.length === 0) {
      console.log('No user ads available, looping company ad');
      if (companyAds.length > 0) {
        setCurrentAdIndex(-1); // Keep showing company ad
      } else {
        console.log('No company ads available either');
      }
      return;
    }
    
    // If slots are not full (less than 5 ads), include company ads in rotation
    if (ads.length < 5) {
      // If currently showing a user ad
      if (currentAdIndex >= 0) {
        // If this is the last user ad, show company ad next
        if (currentAdIndex === ads.length - 1) {
          setCurrentAdIndex(-1); // Show company ad next
        } else {
          setCurrentAdIndex(currentAdIndex + 1); // Show next user ad
        }
      } else {
        // Currently showing company ad, go back to first user ad
        setCurrentAdIndex(0);
      }
    } else {
      // All 5 slots are full: cycle through user ads only
      if (currentAdIndex < ads.length - 1) {
        setCurrentAdIndex(currentAdIndex + 1);
      } else {
        setCurrentAdIndex(0); // Loop back to first ad
      }
    }
  };

  const handleVideoError = (error: any) => {
    console.error('Video playback error:', error);
    
    // Try to get more specific error information
    let errorMessage = 'Failed to play video';
    if (error && error.error && error.error.message) {
      errorMessage = `Video error: ${error.error.message}`;
    } else if (error && error.message) {
      errorMessage = `Video error: ${error.message}`;
    }
    
    console.log('Ad Player Error:', errorMessage);
    console.log('Current ad causing error:', currentAd);
    console.log('Retry count:', retryCount, 'Max retries:', maxRetries);
    
    // If this is a network error (404, etc.), try to skip to next ad or retry
    if (errorMessage.includes('404') || errorMessage.includes('Response code') || errorMessage.includes('Network error')) {
      console.log('Network error detected, attempting to handle...');
      
      // If we haven't exceeded max retries, try again
      if (retryCount < maxRetries) {
        console.log(`Retrying video playback (${retryCount + 1}/${maxRetries})...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          // Force video to reload by updating the key
          setVideoActuallyStarted(false);
          setIsTransitioning(false);
        }, 2000); // Wait 2 seconds before retry
        return;
      }
      
      // If we've exceeded max retries, try the next ad
      console.log('Max retries exceeded, attempting to skip to next ad...');
      setRetryCount(0); // Reset retry count for next ad
      
      // If we have user ads, try the next one
      if (ads.length > 0) {
        setTimeout(() => {
          handleVideoEnd(); // Skip to next ad
        }, 1000);
        return;
      } else {
        // If no user ads, try company ad if we're not already showing it
        if (currentAdIndex !== -1 && companyAds.length > 0) {
          console.log('No user ads available, switching to company ad');
          setTimeout(() => {
            setCurrentAdIndex(-1); // Switch to company ad
            setIsTransitioning(false);
          }, 1000);
          return;
        } else {
          // We're already on company ad and it's failing, or no company ads available
          console.log('Company ad also failed or no company ads available, showing error');
        }
      }
    }
    
    setError(errorMessage);
    if (onAdError) {
      onAdError(errorMessage);
    }
  };

  const handleRefresh = () => {
    fetchAds();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading advertisements...</Text>
        </View>
      </View>
    );
  }

  // Show error if device is not registered
  if (isRegistered === false) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Device Not Registered</Text>
          <Text style={styles.errorText}>
            This tablet needs to be registered before it can display advertisements.
          </Text>
        </View>
      </View>
    );
  }

  // If we have an error but no current ad, try to show company ad as fallback
  if (error && !currentAd && ads.length === 0 && companyAds.length > 0) {
    console.log('Error with no ads, attempting to show company ad as fallback');
    // Force show company ad
    const fallbackAd = {
      adId: companyAds[0].id,
      adTitle: companyAds[0].title,
      mediaFile: companyAds[0].mediaFile,
      duration: companyAds[0].duration
    };
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.videoContainer}
          onPress={handleScreenTap}
          activeOpacity={1}
        >
          <Video
            key="fallback-company-ad"
            ref={videoRef}
            source={{ uri: fallbackAd.mediaFile }}
            style={styles.video}
            useNativeControls={false}
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={true} // Loop the company ad when it's the only option
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                setIsPlaying(status.isPlaying || false);
              }
            }}
            onError={(error) => {
              console.error('Fallback company ad also failed:', error);
              // If even the company ad fails, show the error
            }}
          />
          
          {/* Minimal Ad Info Overlay */}
          <View style={styles.adInfoOverlay}>
            <Text style={styles.adTitle}>{fallbackAd.adTitle}</Text>
          </View>

          {/* Ad Counter */}
          <View style={styles.adCounter}>
            <Text style={styles.adCounterText}>Company (Fallback)</Text>
          </View>
        </TouchableOpacity>
        
        {/* Error indicator */}
        <View style={styles.offlineIndicator}>
          <Ionicons name="alert-circle" size={16} color="#e74c3c" />
          <Text style={styles.offlineText}>Using fallback ad - {error}</Text>
        </View>
      </View>
    );
  }

  if (error || !currentAd || ads.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#e74c3c" />
          <Text style={styles.errorTitle}>No Ads Available</Text>
          <Text style={styles.errorText}>
            {error || 'No advertisements are currently scheduled for this slot.'}
          </Text>
          <Text style={styles.errorSubtext}>
            This could be due to:
          </Text>
          <Text style={styles.errorSubtext}>
            • No ads scheduled for this time slot
          </Text>
          <Text style={styles.errorSubtext}>
            • Network connectivity issues
          </Text>
          <Text style={styles.errorSubtext}>
            • Invalid material ID or slot number
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Offline Indicator */}
      {isOffline && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="wifi-outline" size={16} color="#f39c12" />
          <Text style={styles.offlineText}>Offline Mode - Using Cached Ads</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.videoContainer}
        onPress={handleScreenTap}
        activeOpacity={1}
      >
        <Video
          key={`${currentAd?.adId || 'no-ad'}-${retryCount}`} // Force re-render when switching ads or retrying
          ref={videoRef}
          source={{ uri: currentAd?.mediaFile || '' }}
          style={styles.video}
          useNativeControls={false}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying || false);
              
              // Track ad playback when video starts playing (only if not already started)
              // Use more reliable conditions: isPlaying AND positionMillis > 0 AND isLoaded
              if (status.isPlaying && status.isLoaded && status.positionMillis > 0 && currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad' && !adStartTime && !videoActuallyStarted) {
                console.log(`🎬 Video ACTUALLY playing with position ${status.positionMillis}ms, tracking ad: ${currentAd.adTitle}`);
                
                // Add a small delay to ensure video is really playing and not just buffering
                setTimeout(() => {
                  // Double-check that video is still playing after delay
                  if (status.isPlaying && status.positionMillis > 0) {
                    console.log(`🎬 Video confirmed playing after delay, position: ${status.positionMillis}ms`);
                    setAdStartTime(new Date());
                    trackAdPlayback(currentAd.adId, currentAd.adTitle, currentAd.duration, 0); // Start of ad playback
                    
                    // NOW start WebSocket updates when video is CONFIRMED playing
                    console.log('🎬 [AdPlayer] Video CONFIRMED playing - starting WebSocket updates NOW');
                    // Use actual video duration if available
                    const duration = status.durationMillis ? status.durationMillis / 1000 : currentAd.duration;
                    playbackWebSocketService.startPlaybackUpdates({
                      adId: currentAd.adId,
                      adTitle: currentAd.adTitle,
                      state: 'playing',
                      currentTime: status.positionMillis / 1000, // Use actual position
                      duration: duration,
                      progress: duration > 0 ? ((status.positionMillis / 1000) / duration) * 100 : 0,
                      remainingTime: duration - (status.positionMillis / 1000),
                      playbackRate: status.rate || 1.0,
                      volume: status.volume || 1.0,
                      isMuted: status.isMuted || false,
                      hasJustStarted: true,
                      adDetails: {
                        adId: currentAd.adId,
                        adTitle: currentAd.adTitle,
                        adDuration: currentAd.duration,
                        mediaFile: currentAd.mediaFile,
                        slotNumber: slotNumber,
                        materialId: materialId,
                        isCompanyAd: currentAdIndex === -1,
                        adIndex: currentAdIndex,
                        totalAds: ads.length
                      },
                      startTime: new Date().toISOString()
                    });
                    
                    // Mark that WebSocket updates have started and video has actually started
                    setWebsocketUpdatesStarted(true);
                    setVideoActuallyStarted(true);
                  } else {
                    console.log('🎬 Video stopped playing during delay, not starting WebSocket updates');
                  }
                }, 500); // 500ms delay to ensure video is really playing
              }
              
              // Send ultra-detailed real-time WebSocket updates during playback
              if (currentAd && status.isPlaying && status.isLoaded && !isTransitioning && websocketUpdatesStarted) {
                // Only send progress updates when video is ACTUALLY playing and WebSocket updates have started
                const currentTime = status.positionMillis / 1000;
                // Use the actual video duration from the video player, not the ad data
                const duration = status.durationMillis ? status.durationMillis / 1000 : currentAd.duration;
                const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
                
                // Calculate remaining time and playback speed
                const remainingTime = Math.max(0, duration - currentTime);
                const playbackRate = status.rate || 1.0;
                const volume = status.volume || 1.0;
                
                playbackWebSocketService.updatePlaybackData({
                  state: 'playing',
                  currentTime: currentTime,
                  duration: duration,
                  progress: progress,
                  remainingTime: remainingTime,
                  playbackRate: playbackRate,
                  volume: volume,
                  isMuted: status.isMuted || false,
                  hasJustStarted: (status as any).hasJustStarted || false,
                  hasJustFinished: (status as any).hasJustFinished || false,
                  // Additional detailed info
                  adDetails: {
                    adId: currentAd.adId,
                    adTitle: currentAd.adTitle,
                    adDuration: currentAd.duration,
                    mediaFile: currentAd.mediaFile,
                    slotNumber: slotNumber,
                    materialId: materialId,
                    isCompanyAd: currentAdIndex === -1,
                    adIndex: currentAdIndex,
                    totalAds: ads.length
                  }
                });
              } else if (currentAd && !status.isPlaying && status.positionMillis > 0 && status.isLoaded && !isTransitioning) {
                // Video is paused (but loaded)
                const currentTime = status.positionMillis / 1000;
                // Use the actual video duration from the video player
                const duration = status.durationMillis ? status.durationMillis / 1000 : currentAd.duration;
                const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
                const remainingTime = Math.max(0, duration - currentTime);
                
                playbackWebSocketService.updatePlaybackData({
                  state: 'paused',
                  currentTime: currentTime,
                  duration: duration,
                  progress: progress,
                  remainingTime: remainingTime,
                  playbackRate: status.rate || 1.0,
                  volume: status.volume || 1.0,
                  isMuted: status.isMuted || false,
                  adDetails: {
                    adId: currentAd.adId,
                    adTitle: currentAd.adTitle,
                    adDuration: currentAd.duration,
                    mediaFile: currentAd.mediaFile,
                    slotNumber: slotNumber,
                    materialId: materialId,
                    isCompanyAd: currentAdIndex === -1,
                    adIndex: currentAdIndex,
                    totalAds: ads.length
                  }
                });
              } else if (currentAd && (!status.isLoaded || !status.isPlaying)) {
                // Video is buffering/loading - DON'T send any updates, just stop the interval
                // This prevents false progress updates during buffering
                playbackWebSocketService.stopPlaybackUpdates();
                
                // Only send one buffering state update, then stop
                if (!websocketUpdatesStarted) {
                  const duration = status.durationMillis ? status.durationMillis / 1000 : currentAd.duration;
                  
                  playbackWebSocketService.updatePlaybackDataAndSend({
                    adId: currentAd.adId,
                    adTitle: currentAd.adTitle,
                    state: 'buffering',
                    currentTime: 0, // Always 0 during buffering
                    duration: duration,
                    progress: 0, // Always 0 during buffering
                    remainingTime: duration,
                    playbackRate: 0,
                    volume: status.volume || 1.0,
                    isMuted: status.isMuted || false,
                    adDetails: {
                      adId: currentAd.adId,
                      adTitle: currentAd.adTitle,
                      adDuration: currentAd.duration,
                      mediaFile: currentAd.mediaFile,
                      slotNumber: slotNumber,
                      materialId: materialId,
                      isCompanyAd: currentAdIndex === -1,
                      adIndex: currentAdIndex,
                      totalAds: ads.length
                    }
                  });
                  
                  setWebsocketUpdatesStarted(true);
                }
              }
              
              if (status.didJustFinish) {
                // Stop WebSocket updates when ad ends
                playbackWebSocketService.stopPlaybackUpdates();
                handleVideoEnd();
              }
            } else if (status.error) {
              // Handle buffering/loading states with detailed error info
              if (currentAd) {
                const errorStatus = status as any;
                playbackWebSocketService.updatePlaybackDataAndSend({
                  adId: currentAd.adId,
                  adTitle: currentAd.adTitle,
                  state: 'buffering',
                  currentTime: errorStatus.positionMillis ? errorStatus.positionMillis / 1000 : 0,
                  duration: currentAd.duration,
                  progress: errorStatus.positionMillis && errorStatus.durationMillis ? 
                    (errorStatus.positionMillis / errorStatus.durationMillis) * 100 : 0,
                  remainingTime: currentAd.duration - (errorStatus.positionMillis ? errorStatus.positionMillis / 1000 : 0),
                  playbackRate: 0,
                  volume: errorStatus.volume || 1.0,
                  isMuted: errorStatus.isMuted || false,
                  adDetails: {
                    adId: currentAd.adId,
                    adTitle: currentAd.adTitle,
                    adDuration: currentAd.duration,
                    mediaFile: currentAd.mediaFile,
                    slotNumber: slotNumber,
                    materialId: materialId,
                    isCompanyAd: currentAdIndex === -1,
                    adIndex: currentAdIndex,
                    totalAds: ads.length
                  }
                });
              }
            }
          }}
          onError={handleVideoError}
          onLoadStart={() => {
            console.log('Video loading started:', currentAd?.mediaFile);
            if (currentAd) {
              playbackWebSocketService.updatePlaybackDataAndSend({
                adId: currentAd.adId,
                adTitle: currentAd.adTitle,
                state: 'loading',
                currentTime: 0,
                duration: currentAd.duration, // Use ad duration for loading states
                progress: 0,
                remainingTime: currentAd.duration,
                playbackRate: 0,
                volume: 1.0,
                isMuted: false,
                adDetails: {
                  adId: currentAd.adId,
                  adTitle: currentAd.adTitle,
                  adDuration: currentAd.duration,
                  mediaFile: currentAd.mediaFile,
                  slotNumber: slotNumber,
                  materialId: materialId,
                  isCompanyAd: currentAdIndex === -1,
                  adIndex: currentAdIndex,
                  totalAds: ads.length
                }
              });
            }
          }}
          onLoad={() => {
            console.log('Video loaded successfully:', currentAd?.mediaFile);
            if (currentAd) {
              playbackWebSocketService.updatePlaybackDataAndSend({
                adId: currentAd.adId,
                adTitle: currentAd.adTitle,
                state: 'buffering',
                currentTime: 0,
                duration: currentAd.duration, // Use ad duration for loading states
                progress: 0,
                remainingTime: currentAd.duration,
                playbackRate: 0,
                volume: 1.0,
                isMuted: false,
                adDetails: {
                  adId: currentAd.adId,
                  adTitle: currentAd.adTitle,
                  adDuration: currentAd.duration,
                  mediaFile: currentAd.mediaFile,
                  slotNumber: slotNumber,
                  materialId: materialId,
                  isCompanyAd: currentAdIndex === -1,
                  adIndex: currentAdIndex,
                  totalAds: ads.length
                }
              });
            }
          }}
          onReadyForDisplay={() => {
            console.log('Video ready for display:', currentAd?.mediaFile);
            if (currentAd && !websocketUpdatesStarted) {
              console.log('🎬 [AdPlayer] Video ready for display - but NOT starting progress yet, waiting for actual playback');
              
              // Clear transitioning state - video is ready
              setIsTransitioning(false);
              
              // DON'T start WebSocket updates yet - wait for actual playback
              // Just send a single buffering state to indicate video is ready
              playbackWebSocketService.updatePlaybackDataAndSend({
                adId: currentAd.adId,
                adTitle: currentAd.adTitle,
                state: 'buffering', // Still buffering until actually playing
                currentTime: 0,
                duration: currentAd.duration,
                progress: 0,
                remainingTime: currentAd.duration,
                playbackRate: 0,
                volume: 1.0,
                isMuted: false,
                adDetails: {
                  adId: currentAd.adId,
                  adTitle: currentAd.adTitle,
                  adDuration: currentAd.duration,
                  mediaFile: currentAd.mediaFile,
                  slotNumber: slotNumber,
                  materialId: materialId,
                  isCompanyAd: currentAdIndex === -1,
                  adIndex: currentAdIndex,
                  totalAds: ads.length
                }
              });
              
              // DON'T set websocketUpdatesStarted yet - wait for actual playback
            }
          }}
        />
        
        {/* Minimal Ad Info Overlay - Always visible */}
        <View style={styles.adInfoOverlay}>
          <Text style={styles.adTitle}>{currentAd?.adTitle || 'No Ad'}</Text>
        </View>

        {/* Ad Counter - Always visible */}
        <View style={styles.adCounter}>
          <Text style={styles.adCounterText}>
            {currentAdIndex === -1 ? 'Company' : `${currentAdIndex + 1}/${ads.length < 5 ? ads.length + 1 : ads.length}`}
          </Text>
        </View>

        {/* QR Code Overlay - Always visible for user ads */}
        {currentAd && currentAdIndex >= 0 && qrData && (
          <View style={styles.qrOverlay}>
            <View style={styles.qrContainer}>
              <QRCode
                value={qrData}
                size={100}
                color="#000000"
                backgroundColor="#FFFFFF"
                logoSize={20}
                logoMargin={2}
                logoBackgroundColor="transparent"
              />
            </View>
            <Text style={styles.qrLabel}>📱 Scan with your phone</Text>
            <Text style={styles.qrSubLabel}>Point your camera at this QR code</Text>
          </View>
        )}

        {/* Debug Info Overlay */}
        {showDebugInfo && (
          <View style={styles.debugOverlay}>
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>🔧 Debug Information</Text>
              <Text style={styles.debugText}>Ad ID: {currentAd?.adId || 'N/A'}</Text>
              <Text style={styles.debugText}>Ad Title: {currentAd?.adTitle || 'N/A'}</Text>
              <Text style={styles.debugText}>Material ID: {materialId}</Text>
              
              {/* Debug QR Scan Button */}
              {currentAd && currentAdIndex >= 0 && (
                <TouchableOpacity 
                  style={styles.debugButton} 
                  onPress={handleQRInteraction}
                >
                  <Text style={styles.debugButtonText}>🔍 Test QR Scan Tracking</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.debugText}>Slot Number: {slotNumber}</Text>
              <Text style={styles.debugText}>Current Index: {currentAdIndex}</Text>
              <Text style={styles.debugText}>Total Ads: {ads.length}</Text>
              <Text style={styles.debugText}>Company Ads: {companyAds.length}</Text>
              <Text style={styles.debugText}>Is Playing: {isPlaying ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Network Status: {networkStatus ? 'Online' : 'Offline'}</Text>
              <Text style={styles.debugText}>Is Offline: {isOffline ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Tap Count: {tapCount} (10 taps to activate)</Text>
              <Text style={styles.debugText}>Controls Visible: {showControls ? 'Yes' : 'No'}</Text>
              <Text style={styles.debugText}>Ad Start Time: {adStartTime ? adStartTime.toISOString() : 'N/A'}</Text>
              <Text style={styles.debugText}>Media File: {currentAd?.mediaFile ? 'Present' : 'N/A'}</Text>
              <Text style={styles.debugText}>Duration: {currentAd?.duration || 'N/A'}s</Text>
              
              <TouchableOpacity 
                style={styles.debugCloseButton}
                onPress={() => setShowDebugInfo(false)}
              >
                <Text style={styles.debugCloseButtonText}>Close Debug Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </TouchableOpacity>

      {/* Controls */}
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={16} color="#3498db" />
            <Text style={styles.controlButtonText}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => setShowControls(false)}>
            <Ionicons name="eye-off" size={16} color="#3498db" />
            <Text style={styles.controlButtonText}>Hide Controls</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  errorTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#bdc3c7',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorSubtext: {
    color: '#95a5a6',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  adInfoOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 6,
  },
  adTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  adCounter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adCounterText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3498db',
    gap: 6,
  },
  controlButtonText: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: '600',
  },
  qrOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  qrLabel: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qrSubLabel: {
    color: 'white',
    fontSize: 8,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  debugOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  debugContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  debugTitle: {
    color: '#3498db',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  debugText: {
    color: '#ecf0f1',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  debugButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugCloseButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  debugCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdPlayer;
