import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions, StatusBar, Platform, Alert, AppState } from 'react-native';
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
import adaptiveGPSService from '../services/adaptiveGPSService';
import requestManager from '../services/requestManager';

// API Base URL - should match the one in tabletRegistration service
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.7:5000';

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
import { log } from '../utils/logger';

interface AdPlayerProps {
  materialId: string;
  slotNumber: number;
  onAdError?: (error: string) => void;
  isOffline?: boolean;
  isLocked?: boolean;
  onLockStateChange?: (isLocked: boolean) => void;
}

const AdPlayer: React.FC<AdPlayerProps> = ({ materialId, slotNumber, onAdError, isOffline = false, isLocked = true, onLockStateChange }) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [companyAds, setCompanyAds] = useState<CompanyAd[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [companyAdRepeatIndex, setCompanyAdRepeatIndex] = useState(0); // Track which company ad repetition (0, 1, 2, etc.)
  // Master-Slave Logic: Slot 1 = Master (active player), Slot 2 = Slave (mirror display)
  const [isMaster, setIsMaster] = useState(slotNumber === 1); // Slot 1 is always master by default
  const [loading, setLoading] = useState(true);
  const [waitingForMaster, setWaitingForMaster] = useState(slotNumber === 2); // Slot 2 waits for master
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [qrCodeReady, setQrCodeReady] = useState(false);
  const [videoActuallyStarted, setVideoActuallyStarted] = useState(false);
  
  // Guard to prevent multiple concurrent handleVideoEnd calls
  const isHandlingVideoEnd = useRef(false);
  // Guard to prevent multiple simultaneous syncs for Slot 2
  const isSyncingSlot2 = useRef(false);
  // Track last pause state update time to prevent rapid toggling
  const lastPauseStateUpdate = useRef<number>(0);
  const PAUSE_STATE_UPDATE_THROTTLE = 200; // Only update pause state every 200ms
  // Track last play command time to prevent rapid play/pause toggling
  const lastPlayCommandTime = useRef<number>(0);
  const PLAY_COMMAND_THROTTLE = 200; // Only send play command every 200ms (reduced from 500ms to allow faster playback recovery)
  // ✅ NEW: Throttle display data broadcasting to prevent flooding Slot 2
  const lastDisplayDataTime = useRef<number>(0);
  const DISPLAY_DATA_THROTTLE = 300; // Only send display data every 300ms (3-4 times per second is enough)
  const lastBroadcastAdIndex = useRef<number>(-999); // Track last ad index that was broadcast to detect ad changes
  // ✅ NEW: Debounce display data processing on Slot 2 to prevent rapid sync loops
  const lastDisplayDataProcessTime = useRef<number>(0);
  const DISPLAY_DATA_PROCESS_DEBOUNCE = 200; // Ignore display data if we just processed one within 200ms (increased from 100ms to prevent seek loops)
  // ✅ CRITICAL FIX: Track last sync time to prevent seek loop during buffering
  const lastSyncCommandTime = useRef<number>(0);
  const SYNC_COMMAND_COOLDOWN = 3000; // Don't sync again for 3 seconds after a sync (allows buffering and seek to complete)
  // ✅ NEW: Persistent playback enforcer for ad transitions - keeps trying to play until video actually starts
  const playbackEnforcerInterval = useRef<any>(null);
  const lastEnforcedAdIndex = useRef<number>(-1);
  const shouldBePlayingRef = useRef<boolean>(false); // Track if video should be playing
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);
  const lastPlaybackUpdateTime = useRef(0); // Throttle playback updates to admin
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncData, setSyncData] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentGPS, setCurrentGPS] = useState<any>(null); // Store current GPS data
  const [masterConnected, setMasterConnected] = useState(false); // Track if master (Slot 1) is connected
  const [lastMasterUpdate, setLastMasterUpdate] = useState<Date | null>(null); // Track last update from master
  const [hasReceivedInitialSync, setHasReceivedInitialSync] = useState(false); // Track if Slot 2 has received first sync
  const [lastSyncPosition, setLastSyncPosition] = useState<number | null>(null); // Track last synced position for drift detection
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now()); // Track when last sync occurred
  const [wasBuffering, setWasBuffering] = useState(false); // Track previous buffering state
  const [currentVideoPosition, setCurrentVideoPosition] = useState<number>(0); // Track current video position for drift detection
  const lastNonZeroSyncPosition = useRef<number | null>(null); // Track last synced position that was > 0 (to detect stale position 0 data)
  const positionDriftCheckInterval = useRef<NodeJS.Timeout | null>(null); // Interval for periodic drift checks
  const seekFailureCount = useRef<number>(0); // Track consecutive seek failures
  const MAX_SEEK_FAILURES = 3; // Stop trying to sync if seek fails this many times
  const lastSuccessfulSeekTime = useRef<number>(0); // Track when last successful seek occurred
  const videoRef = useRef<Video>(null);
  const [isCompanyAdsOnlyMode, setIsCompanyAdsOnlyMode] = useState(false); // Track if in company-ads-only mode (after 8 hours)

  // Cache key for storing ads locally
  const getCacheKey = () => `ads_${materialId}_${slotNumber}`;

  // Check registration status on mount
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const registered = await tabletRegistrationService.checkRegistrationStatus();
        setIsRegistered(registered);
        if (!registered) {
          // Don't set error for unregistered - it's informational, not an error
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking registration status:', error);
        setError('Unable to verify registration status');
        setLoading(false);
      }
    };
    
    checkRegistration();
  }, []);

  // Log master/slave role on mount
  useEffect(() => {
    if (slotNumber === 1) {
      console.log('👑 [AdPlayer] This is SLOT 1 - MASTER MODE (Active Player)');
      console.log('✅ [AdPlayer] Will fetch ads, play videos, send tracking and broadcast display data');
    } else if (slotNumber === 2) {
      console.log('👥 [AdPlayer] This is SLOT 2 - SLAVE MODE (Mirror Display)');
      console.log('🔄 [AdPlayer] Will mirror Slot 1 display, no ad fetching or tracking');
      console.log('⚡ [AdPlayer] Waiting for display data from master (Slot 1)...');
    }
  }, [slotNumber]);

  // Initialize Adaptive GPS Service
  useEffect(() => {
    if (isRegistered) {
      console.log('📍 [AdPlayer] Starting adaptive GPS tracking');
      
      // Start GPS tracking with callback
      adaptiveGPSService.startTracking(
        (gpsData) => {
          // Update current GPS state
          setCurrentGPS(gpsData);
          
          // Only log occasionally to reduce noise
          if (Math.random() < 0.05) { // 5% of updates
            console.log('📍 [AdPlayer] GPS updated:', {
              speed: `${(gpsData.speed * 3.6).toFixed(1)} km/h`,
              accuracy: `${gpsData.accuracy.toFixed(1)}m`
            });
          }
        },
        {
          isAdPlaying: isPlaying && !isPaused,
          currentSpeed: 0 // Will be updated from GPS data
        }
      );
    }

    return () => {
      // Stop GPS tracking when component unmounts
      if (isRegistered) {
        console.log('📍 [AdPlayer] Stopping adaptive GPS tracking');
        adaptiveGPSService.stopTracking();
      }
    };
  }, [isRegistered]);

  // Update GPS config when ad playback state changes
  useEffect(() => {
    if (isRegistered && adaptiveGPSService.isActive()) {
      const isAdPlaying = isPlaying && !isPaused;
      adaptiveGPSService.updateConfig({
        isAdPlaying,
        currentSpeed: currentGPS?.speed || 0
      });
      
      // Only log state changes
      if (Math.random() < 0.2) { // 20% of state changes
        console.log(`📍 [AdPlayer] GPS config updated: Ad ${isAdPlaying ? 'playing' : 'paused/stopped'}`);
      }
    }
  }, [isPlaying, isPaused, isRegistered]);

  // Setup WebSocket synchronization
  useEffect(() => {
    if (isRegistered) {
      // Set up slot synchronization callback
      playbackWebSocketService.setSlotSyncCallback(handleSlotSync);
      // Set up pause all callback
      playbackWebSocketService.setPauseAllCallback(handlePauseAll);
      // Set up resume all callback
      playbackWebSocketService.setResumeAllCallback(handleResumeAll);
      // Set up stop all callback
      playbackWebSocketService.setStopAllCallback(handleStopAll);
      // Set up slot sync callback
      playbackWebSocketService.setSlotSyncCallback(handleSlotSync);
      // Set up display data callback
      playbackWebSocketService.setDisplayDataCallback(handleDisplayData);
      // Set up lockdown callback
      playbackWebSocketService.setLockdownCallback(handleLockdown);
      // Set up unlock callback - update when onLockStateChange changes
      playbackWebSocketService.setUnlockCallback(handleUnlock);
      // Set up 8-hour stop callback
      playbackWebSocketService.setStop8HoursCallback(handleStop8Hours);
      // Set up company ads only callback
      playbackWebSocketService.setCompanyAdsOnlyCallback(handleCompanyAdsOnly);
      // Set up refresh ads callback
      playbackWebSocketService.setRefreshAdsCallback(handleRefreshAds);
      
      // Connect to WebSocket
      playbackWebSocketService.connect().then((connected) => {
        if (connected) {
          // ✅ FIX: Only Slot 2 (slave) needs periodic sync for initial connection
          // Slot 1 (master) doesn't need to request sync - it broadcasts its own state
          if (slotNumber === 2) {
            // Request initial synchronization after a delay to allow master to start
            setTimeout(() => {
              if (!hasReceivedInitialSync) {
                console.log('📺 [Slot 2 Init] Requesting initial sync with master');
                playbackWebSocketService.requestSync();
              }
            }, 3000); // Wait 3 seconds before first sync request
          }
        }
      });
      
      // ✅ FIX: Only Slot 2 needs a backup periodic sync request
      // This is ONLY for the initial sync - after that, display data handles everything
      // ✅ CRITICAL: Stop interval as soon as we receive initial sync
      if (slotNumber === 2) {
        positionDriftCheckInterval.current = setInterval(() => {
          // Only request sync if we haven't received initial sync yet
          // Once synced, display data will handle all updates
          if (!hasReceivedInitialSync) {
            const timeSinceLastSync = (Date.now() - lastSyncTime) / 1000;
            
            // Request sync every 15 seconds only if we haven't synced yet (increased from 10s)
            if (timeSinceLastSync > 15) {
              console.log(`📺 [Slot 2 Backup] Requesting initial sync (${timeSinceLastSync.toFixed(1)}s since last attempt)`);
              playbackWebSocketService.requestSync();
            }
          } else {
            // ✅ CRITICAL: Stop the interval once we've synced
            if (positionDriftCheckInterval.current) {
              console.log('✅ [Slot 2 Backup] Initial sync received - stopping backup sync requests');
              clearInterval(positionDriftCheckInterval.current);
              positionDriftCheckInterval.current = null;
            }
          }
        }, 15000); // Check every 15 seconds as backup safety net
      }
    }

    return () => {
      playbackWebSocketService.setSlotSyncCallback(() => {});
      playbackWebSocketService.setDisplayDataCallback(() => {});
      playbackWebSocketService.setPauseAllCallback(() => {});
      playbackWebSocketService.setResumeAllCallback(() => {});
      playbackWebSocketService.setStopAllCallback(() => {});
      playbackWebSocketService.setRefreshAdsCallback(() => {});
      
      // Clear position drift check interval
      if (positionDriftCheckInterval.current) {
        clearInterval(positionDriftCheckInterval.current);
        positionDriftCheckInterval.current = null;
      }
      
      // ✅ NEW: Clear playback enforcer on component unmount
      stopPlaybackEnforcer();
    };
  }, [isRegistered, slotNumber, lastSyncPosition, currentVideoPosition, lastSyncTime]);

  // Update unlock callback when onLockStateChange prop changes
  useEffect(() => {
    if (isRegistered) {
      playbackWebSocketService.setUnlockCallback(handleUnlock);
    }
  }, [isRegistered, onLockStateChange]); // Update when onLockStateChange changes

  // Execute perfect synchronization
  const executePerfectSync = (message: any) => {
    try {
      console.log(`🔄 [AdPlayer] Executing perfect sync for material: ${message.materialId}${message.testMode ? ' [TEST MODE]' : ''}`);
      
      // Set syncing state to show visual indicator
      setIsSyncing(true);
      setIsPaused(false);
      
      // If this is the reference device, just continue playing
      if (message.targetDeviceId === message.referenceDeviceId) {
        console.log(`🔄 [AdPlayer] This is the reference device - continuing current playback`);
        // In test mode, show sync indicator briefly
        if (message.testMode) {
          setTimeout(() => {
            setIsSyncing(false);
            console.log(`🔄 [AdPlayer] Test mode sync completed`);
          }, 2000);
        }
        return;
      }
      
      // For non-reference devices, sync to the reference device's state
      console.log(`🔄 [AdPlayer] Syncing to reference device: ${message.referenceDeviceId}`);
      
      // Request current state from reference device
      playbackWebSocketService.requestSync();
      
      // Set a flag to indicate we're in perfect sync mode
      setSyncData({
        ...message,
        perfectSync: true,
        executedAt: new Date().toISOString()
      });
      
      // Auto-clear sync state after 5 seconds
      setTimeout(() => {
        setIsSyncing(false);
        console.log(`🔄 [AdPlayer] Sync state cleared`);
      }, 5000);
      
      console.log(`🔄 [AdPlayer] Perfect sync executed successfully`);
    } catch (error) {
      console.error('❌ [AdPlayer] Error executing perfect sync:', error);
      setIsSyncing(false);
    }
  };

  // Helper function to sync position and play for Slot 2
  const syncPositionAndPlay = useCallback((currentTime?: number) => {
    const now = Date.now();
    const timeSinceLastPlay = now - lastPlayCommandTime.current;
    
    // Throttle play commands to prevent rapid toggling
    if (timeSinceLastPlay < PLAY_COMMAND_THROTTLE) {
      console.log(`⏭️ [Slot 2 Sync] Skipping play command (throttled, ${timeSinceLastPlay}ms since last)`);
      // Still sync position even if we skip play
      if (videoRef.current && currentTime !== undefined) {
        const seekTime = currentTime * 1000;
        videoRef.current.setPositionAsync(seekTime).catch(err => {
          console.warn(`⚠️ [Slot 2 Sync] Error seeking (throttled):`, err);
        });
      }
      return;
    }
    
    if (videoRef.current && currentTime !== undefined) {
      const seekTime = currentTime * 1000;
      videoRef.current.setPositionAsync(seekTime).then(() => {
        // ✅ CRITICAL: Force play immediately after seeking
        if (videoRef.current) {
          lastPlayCommandTime.current = Date.now();
          videoRef.current.playAsync().catch(err => {
            console.warn(`⚠️ [Slot 2 Sync] Error playing:`, err);
          });
          console.log(`▶️ [Slot 2 Sync] Force play after position sync to ${currentTime.toFixed(1)}s`);
        }
      }).catch(err => {
        console.warn(`⚠️ [Slot 2 Sync] Error seeking:`, err);
        // Try to play anyway
        if (videoRef.current) {
          lastPlayCommandTime.current = Date.now();
          videoRef.current.playAsync().catch(playErr => {
            console.warn(`⚠️ [Slot 2 Sync] Error playing after seek error:`, playErr);
          });
        }
      });
    } else if (videoRef.current) {
      // No position, just play
      lastPlayCommandTime.current = Date.now();
      videoRef.current.playAsync().catch(err => {
        console.warn(`⚠️ [Slot 2 Sync] Error playing:`, err);
      });
      console.log(`▶️ [Slot 2 Sync] Force play (no position sync)`);
    }
  }, []);

  // Handle slot synchronization messages (combined legacy and new system)
  const handleSlotSync = (message: any) => {
    try {
      console.log('🔄 [AdPlayer] Received slot sync:', message);
      
      // ✅ CRITICAL FIX: Ignore slot sync messages that claim to come from this slot
      // This prevents processing stale cached data from the server
      if (message.sourceSlot === slotNumber) {
        console.log(`⏭️ [AdPlayer] Ignoring slot sync from same slot (${slotNumber}) - likely stale server cache`);
        return;
      }
      
      // NEW SYSTEM: Handle slot sync commands with action field
      if (message.action) {
        const { syncData, targetTime, adIndex, action, isMaster } = message;
        
        if (action === 'syncToTime') {
          // Perfect synchronization - jump to exact time
          console.log('🔄 [AdPlayer] Syncing to time:', targetTime, 'adIndex:', adIndex);
          
          // Set the ad index first
          if (adIndex !== undefined && adIndex !== currentAdIndex) {
            console.log('🔄 [AdPlayer] Changing ad index from', currentAdIndex, 'to', adIndex);
            setCurrentAdIndex(adIndex);
          }
          
          // Sync video to exact time
          if (videoRef.current && targetTime !== undefined) {
            console.log('🔄 [AdPlayer] Seeking video to time:', targetTime);
            videoRef.current.setPositionAsync(targetTime * 1000).catch(err => {
              console.log('🔄 [AdPlayer] Seek error (expected):', err.message);
            });
          }
          
          // Update playback state
          if (syncData) {
            console.log('🔄 [AdPlayer] Updating playback state from sync data');
            sendPlaybackUpdate({
              adId: syncData.adId,
              adTitle: syncData.adTitle,
              state: syncData.state || 'playing',
              currentTime: targetTime || 0,
              duration: syncData.duration || 0,
              progress: syncData.progress || 0,
            });
          }
          
          console.log('🔄 [AdPlayer] Slot sync completed successfully');
        } else if (action === 'syncState') {
          // Sync playback state (play/pause)
          console.log('🔄 [AdPlayer] Syncing state:', syncData);
          
          if (syncData.isPaused !== undefined) {
            setIsPaused(syncData.isPaused);
            
            if (videoRef.current) {
              if (syncData.isPaused) {
                videoRef.current.pauseAsync().catch(err => {
                  console.log('🔄 [AdPlayer] Pause error (expected):', err.message);
                });
              } else {
                videoRef.current.playAsync().catch(err => {
                  console.log('🔄 [AdPlayer] Play error (expected):', err.message);
                });
              }
            }
          }
          
          console.log('🔄 [AdPlayer] State sync completed successfully');
        } else if (action === 'setMaster') {
          // Set this device as master for display duplication
          console.log('👑 [AdPlayer] This device is now MASTER for display duplication');
          setIsMaster(true);
          // ✅ NEW: Enable broadcasting when explicitly set as master
          if (slotNumber === 2) {
            playbackWebSocketService.setSlaveMode(false);
          }
        } else if (action === 'setSlave') {
          // Set this device as slave for display duplication
          console.log('👥 [AdPlayer] This device is now SLAVE for display duplication');
          setIsMaster(false);
          // ✅ NEW: Disable broadcasting when explicitly set as slave
          if (slotNumber === 2) {
            playbackWebSocketService.setSlaveMode(true);
          }
        }
        return;
      }
      
      // LEGACY SYSTEM: Handle old sync messages for backward compatibility
      // Check if this is a perfect sync command with delayed execution
      if (message.command === 'sync' && message.executeAt && message.syncDelay) {
        console.log(`🔄 [AdPlayer] Perfect sync command received - Execute at: ${message.executeAt}`);
        
        const executeTime = new Date(message.executeAt).getTime();
        const currentTime = Date.now();
        const delay = executeTime - currentTime;
        
        if (delay > 0) {
          console.log(`🔄 [AdPlayer] Waiting ${delay}ms before executing sync...`);
          setIsSyncing(true);
          
          setTimeout(() => {
            console.log(`🔄 [AdPlayer] Executing perfect sync now!`);
            executePerfectSync(message);
          }, delay);
        } else {
          console.log(`🔄 [AdPlayer] Execute time has passed, executing sync immediately`);
          executePerfectSync(message);
        }
        return;
      }
      
      // ✅ FIX: For Slot 2, ONLY use slot sync for initial connection or when display data is not working
      // When master is connected and we're receiving display data, ignore slot sync to prevent conflicts
      // Slot sync is mainly for failover scenarios or initial connection
      if (slotNumber === 2 && message.sourceSlot === 1) {
        // ✅ FIX: If we're already receiving display data from master, skip slot sync
        // Display data is more reliable and frequent, so use that instead
        if (masterConnected && hasReceivedInitialSync) {
          console.log(`⏭️ [Slot 2 Sync] Skipping slot sync - using display data instead (master connected)`);
          return;
        }
        
        // ✅ FIX: Prevent multiple simultaneous syncs
        if (isSyncingSlot2.current) {
          console.log(`⚠️ [Slot 2 Sync] Sync already in progress, skipping duplicate`);
          return;
        }
        
        isSyncingSlot2.current = true;
        console.log(`🔄 [Slot 2 Sync] Received sync from Slot 1: state=${message.state}, adId=${message.adId}`);
        
        // ✅ CRITICAL FIX: Update pause state based on master's state
        if (message.state === 'playing') {
          // Master is playing - ensure Slot 2 is not paused
          // ✅ FIX: Throttle pause state updates to prevent rapid toggling
          const now = Date.now();
          if (now - lastPauseStateUpdate.current < PAUSE_STATE_UPDATE_THROTTLE && !isPaused) {
            // Skip update if recently updated and already in correct state
            console.log(`⏭️ [Slot 2 Sync] Skipping pause state update (throttled)`);
          } else {
            console.log(`▶️ [Slot 2 Sync] Master is playing - setting isPaused to false`);
            setIsPaused(false);
            lastPauseStateUpdate.current = now;
          }
          
          // Update master connection tracking
          setMasterConnected(true);
          setLastMasterUpdate(new Date());
          setWaitingForMaster(false);
          setHasReceivedInitialSync(true);
          
          // Sync ad if different
          if (message.adId && currentAd?.adId !== message.adId) {
            // Find the ad index
            const adIndex = ads.findIndex((ad: any) => ad.adId === message.adId);
            if (adIndex >= 0) {
              console.log(`🔄 [Slot 2 Sync] Switching to ad index ${adIndex}`);
              setCurrentAdIndex(adIndex);
              // Wait a bit for ad to load before syncing position
              setTimeout(() => {
                syncPositionAndPlay(message.currentTime);
              }, 300);
            } else {
              syncPositionAndPlay(message.currentTime);
            }
          } else {
            // Same ad, just sync position
            syncPositionAndPlay(message.currentTime);
          }
          
          setIsSyncing(false);
          // Clear sync guard after a short delay
          setTimeout(() => {
            isSyncingSlot2.current = false;
          }, 500);
          return;
        } else if (message.state === 'paused') {
          // ✅ FIX: Throttle pause state updates to prevent rapid toggling
          const now = Date.now();
          if (now - lastPauseStateUpdate.current < PAUSE_STATE_UPDATE_THROTTLE && isPaused) {
            // Skip update if recently updated and already in correct state
            console.log(`⏭️ [Slot 2 Sync] Skipping pause state update (throttled)`);
          } else {
            console.log(`⏸️ [Slot 2 Sync] Master is paused - setting isPaused to true`);
            setIsPaused(true);
            lastPauseStateUpdate.current = now;
          }
          if (videoRef.current) {
            videoRef.current.pauseAsync().catch(err => {
              console.warn(`⚠️ [Slot 2 Sync] Error pausing:`, err);
            });
          }
          setIsSyncing(false);
          isSyncingSlot2.current = false;
          return;
        }
        
          // Clear guard if we didn't handle the message
          isSyncingSlot2.current = false;
      }
      
      // Original sync logic for backward compatibility (for non-Slot 2 or other cases)
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
      
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling slot sync:', error);
    }
  };

  // Handle pause all command from server
  const handlePauseAll = (message: any) => {
    try {
      console.log('⏸️ [AdPlayer] Received pause all command:', message);
      console.log('⏸️ [AdPlayer] Current ad state:', currentAd);
      console.log('⏸️ [AdPlayer] Video ref state:', videoRef.current ? 'available' : 'not available');
      console.log('⏸️ [AdPlayer] isPaused state:', isPaused);
      
      // ✅ FIX: Slot 2 in slave mode should ignore pause/resume commands from server
      // It should only follow display data from Slot 1 (master)
      if (slotNumber === 2 && masterConnected && !isMaster) {
        console.log('👥 [AdPlayer] Slot 2 in slave mode - ignoring pause command, will follow master display data');
        return;
      }
      
      // Always set paused state when pause command is received
      console.log('⏸️ [AdPlayer] Setting paused state to true');
      setIsPaused(true);
      
      // Force pause the video immediately
      if (videoRef.current) {
        console.log('⏸️ [AdPlayer] Force pausing video player');
        videoRef.current.pauseAsync().catch(err => {
          console.log('⏸️ [AdPlayer] Video pause error (expected):', err.message);
        });
      } else {
        console.log('⏸️ [AdPlayer] Video ref not ready, but marking as paused');
      }
      
      // Note: GPS location tracking should continue even when paused
      // Only ad playback analytics should stop
      console.log('⏸️ [AdPlayer] GPS location tracking will continue - only ad playback stopped');
      
      // If we have a current ad, update it and send WebSocket update
      if (currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad') {
        console.log('⏸️ [AdPlayer] Pausing current ad due to pause all command:', currentAd.adTitle);
        
        // Update the current ad state to paused
        // Note: currentAd is derived from currentAdIndex, so we don't need to update it directly
        
        // Send pause state update to server
        sendPlaybackUpdate({
          adId: currentAd.adId,
          adTitle: currentAd.adTitle,
          state: 'paused',
          currentTime: 0,
          duration: currentAd.duration || 0,
          progress: 0,
        });
        
        console.log('⏸️ [AdPlayer] Ad paused successfully');
      } else {
        console.log('⏸️ [AdPlayer] No current ad to update, but video is paused');
        console.log('⏸️ [AdPlayer] Current ad details:', {
          currentAd,
          adTitle: currentAd?.adTitle,
          isNoAd: currentAd?.adTitle === 'No Ad'
        });
      }
      
      console.log('⏸️ [AdPlayer] Pause all command processed successfully');
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling pause all command:', error);
    }
  };

  // Resume ad playback
  const resumeAd = () => {
    try {
      console.log('▶️ [AdPlayer] Resuming ad playback');
      setIsPaused(false);
      
      if (videoRef.current) {
        console.log('▶️ [AdPlayer] Starting video player');
        videoRef.current.playAsync();
      }
      
      // Reset ad start time
      // Note: currentAd is derived from currentAdIndex, so we don't need to update it directly
      
      // Note: GPS location tracking was never stopped, so no need to restart it
      console.log('▶️ [AdPlayer] Ad resumed successfully - GPS tracking continues');
    } catch (error) {
      console.error('❌ [AdPlayer] Error resuming ad:', error);
    }
  };

  // Handle resume all command from server
  const handleResumeAll = (message: any) => {
    try {
      console.log('▶️ [AdPlayer] Received resume all command:', message);
      console.log('▶️ [AdPlayer] Current ad state:', currentAd);
      console.log('▶️ [AdPlayer] Video ref state:', videoRef.current ? 'available' : 'not available');
      console.log('▶️ [AdPlayer] isPaused state:', isPaused);
      
      // ✅ FIX: Slot 2 in slave mode should ignore pause/resume commands from server
      // It should only follow display data from Slot 1 (master)
      if (slotNumber === 2 && masterConnected && !isMaster) {
        console.log('👥 [AdPlayer] Slot 2 in slave mode - ignoring resume command, will follow master display data');
        return;
      }
      
      // Set resumed state when resume command is received
      console.log('▶️ [AdPlayer] Setting paused state to false');
      setIsPaused(false);
      
      // Try to resume the video if it exists
      if (videoRef.current) {
        console.log('▶️ [AdPlayer] Resuming video player');
        videoRef.current.playAsync().catch(err => {
          console.log('▶️ [AdPlayer] Video resume error (expected):', err.message);
        });
      } else {
        console.log('▶️ [AdPlayer] Video ref not ready, but marking as resumed');
      }
      
      // If we have a current ad, update it and send WebSocket update
      if (currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad') {
        console.log('▶️ [AdPlayer] Resuming current ad due to resume all command:', currentAd.adTitle);
        
        // Update the current ad state to resumed
        // Note: currentAd is derived from currentAdIndex, so we don't need to update it directly
        
        // Send resume state update to server
        sendPlaybackUpdate({
          adId: currentAd.adId,
          adTitle: currentAd.adTitle,
          state: 'playing',
          currentTime: 0,
          duration: currentAd.duration || 0,
          progress: 0,
        });
        
        console.log('▶️ [AdPlayer] Ad resumed successfully');
      } else {
        console.log('▶️ [AdPlayer] No current ad to update, but video is resumed');
        console.log('▶️ [AdPlayer] Current ad details:', {
          currentAd,
          adTitle: currentAd?.adTitle,
          isNoAd: currentAd?.adTitle === 'No Ad'
        });
      }
      
      console.log('▶️ [AdPlayer] Resume all command processed successfully');
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling resume all command:', error);
    }
  };

  // Handle stop all command from server
  const handleStopAll = (message: any) => {
    try {
      console.log('⏹️ [AdPlayer] Received stop all command:', message);
      console.log('⏹️ [AdPlayer] Current ad state:', currentAd);
      console.log('⏹️ [AdPlayer] Video ref state:', videoRef.current ? 'available' : 'not available');
      console.log('⏹️ [AdPlayer] isPaused state:', isPaused);
      
      // ✅ FIX: Slot 2 in slave mode should ignore stop commands from server
      // It should only follow display data from Slot 1 (master)
      if (slotNumber === 2 && masterConnected && !isMaster) {
        console.log('👥 [AdPlayer] Slot 2 in slave mode - ignoring stop command, will follow master display data');
        return;
      }
      
      // Set paused state when stop command is received
      console.log('⏹️ [AdPlayer] Setting paused state to true');
      setIsPaused(true);
      
      // Force pause the video immediately
      if (videoRef.current) {
        console.log('⏹️ [AdPlayer] Force pausing video player');
        videoRef.current.pauseAsync().catch(err => {
          console.log('⏹️ [AdPlayer] Video pause error (expected):', err.message);
        });
      } else {
        console.log('⏹️ [AdPlayer] Video ref not ready, but marking as stopped');
      }
      
      // Note: GPS location tracking should continue even when stopped
      // Only ad playback analytics should stop
      console.log('⏹️ [AdPlayer] GPS location tracking will continue - only ad playback stopped');
      
      // If we have a current ad, update it and send WebSocket update
      if (currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad') {
        console.log('⏹️ [AdPlayer] Stopping current ad due to stop all command:', currentAd.adTitle);
        
        // Send stop state update to server
        sendPlaybackUpdate({
          adId: currentAd.adId,
          adTitle: currentAd.adTitle,
          state: 'stopped',
          currentTime: 0,
          duration: currentAd.duration || 0,
          progress: 0,
        });
        
        console.log('⏹️ [AdPlayer] Ad stopped successfully');
      } else {
        console.log('⏹️ [AdPlayer] No current ad to update, but video is stopped');
        console.log('⏹️ [AdPlayer] Current ad details:', {
          currentAd,
          adTitle: currentAd?.adTitle,
          isNoAd: currentAd?.adTitle === 'No Ad'
        });
      }
      
      console.log('⏹️ [AdPlayer] Stop all command processed successfully');
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling stop all command:', error);
    }
  };

  // ✅ NEW: Persistent playback enforcer for Slot 2 ad transitions
  // This keeps trying to play the video until it actually starts playing
  // Fixes issue where Slot 2 gets stuck at start of new ad
  const startPlaybackEnforcer = (adIndex: number) => {
    if (slotNumber !== 2) return; // Only for Slot 2
    
    // Clear any existing enforcer
    if (playbackEnforcerInterval.current) {
      clearInterval(playbackEnforcerInterval.current);
      playbackEnforcerInterval.current = null;
    }
    
    console.log(`🔄 [Playback Enforcer] Starting for ad ${adIndex}`);
    lastEnforcedAdIndex.current = adIndex;
    shouldBePlayingRef.current = true;
    
    let attempts = 0;
    const maxAttempts = 100; // Try for 10 seconds (100 * 100ms) - more time for slow devices/buffering
    
    playbackEnforcerInterval.current = setInterval(async () => {
      attempts++;
      
      // Stop if max attempts reached
      if (attempts >= maxAttempts) {
        console.warn(`⚠️ [Playback Enforcer] Max attempts reached (${maxAttempts}), stopping`);
        stopPlaybackEnforcer();
        return;
      }
      
      // Stop if ad changed
      if (lastEnforcedAdIndex.current !== currentAdIndex) {
        console.log(`🛑 [Playback Enforcer] Ad changed, stopping enforcer`);
        stopPlaybackEnforcer();
        return;
      }
      
      // Stop if we're not supposed to be playing
      if (!shouldBePlayingRef.current) {
        console.log(`🛑 [Playback Enforcer] Playback paused, stopping enforcer`);
        stopPlaybackEnforcer();
        return;
      }
      
      // ✅ FIX: Don't interfere if we're currently syncing
      if (isSyncingSlot2.current) {
        // Silently skip - sync is in progress, don't interfere
        return;
      }
      
      // ✅ FIX: Don't interfere if we just synced recently (within cooldown period)
      const timeSinceLastSync = Date.now() - lastSyncCommandTime.current;
      if (timeSinceLastSync < SYNC_COMMAND_COOLDOWN) {
        // Silently skip - give sync time to complete
        return;
      }
      
      try {
        const status = await videoRef.current?.getStatusAsync();
        
        if (status && status.isLoaded && status.isPlaying) {
          console.log(`✅ [Playback Enforcer] Video confirmed playing after ${attempts} attempts, stopping enforcer`);
          stopPlaybackEnforcer();
          return;
        }
        
        // Video not playing - force play (but only if not buffering to avoid conflicts)
        if (status && status.isLoaded && !status.isPlaying && !status.isBuffering) {
          console.log(`🔄 [Playback Enforcer] Attempt ${attempts}: Video not playing, forcing playAsync()`);
          await videoRef.current?.playAsync();
        }
      } catch (err) {
        console.warn(`⚠️ [Playback Enforcer] Error on attempt ${attempts}:`, err);
      }
    }, 100); // Check every 100ms
  };
  
  const stopPlaybackEnforcer = () => {
    if (playbackEnforcerInterval.current) {
      clearInterval(playbackEnforcerInterval.current);
      playbackEnforcerInterval.current = null;
      console.log(`🛑 [Playback Enforcer] Stopped`);
    }
  };

  // Handle display data for duplication (slave devices)
  const handleDisplayData = (message: any) => {
    try {
      const { data, sourceSlot, materialId: msgMaterialId } = message;
      
      // Only Slot 2 should process display data from Slot 1
      if (slotNumber !== 2) {
        return;
      }
      
      // Only process if from Slot 1 (master)
      if (sourceSlot !== 1) {
        console.log('⚠️ [AdPlayer] Ignoring display data - not from Slot 1 (master)');
        return;
      }
      
      // Verify it's for our material
      if (msgMaterialId !== materialId) {
        console.log('⚠️ [AdPlayer] Ignoring display data - wrong material');
        return;
      }
      
      // ✅ FIX: Debounce display data processing to prevent rapid sync loops
      // If we just processed display data very recently, skip this one to prevent
      // constant seeking/playing that causes pause/play flickering
      const now = Date.now();
      const timeSinceLastProcess = now - lastDisplayDataProcessTime.current;
      
      // EXCEPTION: Always process if it's the first sync or ad changed
      const adChanged = data.adIndex !== undefined && data.adIndex !== currentAdIndex;
      const isInitialSync = !hasReceivedInitialSync;
      const shouldProcess = isInitialSync || adChanged || timeSinceLastProcess >= DISPLAY_DATA_PROCESS_DEBOUNCE;
      
      if (!shouldProcess) {
        // Silently skip this display data - we just processed one recently
        return;
      }
      
      // Mark that we're processing display data now
      lastDisplayDataProcessTime.current = now;
      
      // ✅ FIX: Update master connection tracking BEFORE processing display data
      // This ensures Slot 2 knows master is connected and can play
      setMasterConnected(true);
      setLastMasterUpdate(new Date());
      setWaitingForMaster(false);
      
      // ✅ FIX: Ensure Slot 2 is in slave mode when receiving display data
      if (isMaster) {
        console.log('👥 [AdPlayer] Slot 2 receiving display data - switching back to SLAVE mode');
        setIsMaster(false);
        // ✅ NEW: Disable broadcasting when reverting to slave mode
        playbackWebSocketService.setSlaveMode(true);
      }
      
      // ✅ FIX: Clear any error state when receiving display data from master
      // This prevents error messages from showing when Slot 2 is properly syncing
      if (error) {
        console.log('✅ [Slave Sync] Clearing error state - receiving display data from master');
        setError(null);
      }
      
      // Apply display data to mirror the master
      if (data) {
        const adChanged = data.adIndex !== undefined && data.adIndex !== currentAdIndex;
        const isInitialSync = !hasReceivedInitialSync; // First sync from master
        
        // Log only on ad changes, pause state changes, or initial sync
        if (adChanged || isInitialSync || (data.isPaused !== undefined && data.isPaused !== isPaused)) {
          console.log('📺 [AdPlayer] Mirroring master:', {
            adIndex: data.adIndex,
            currentTime: data.currentTime?.toFixed(1),
            isPaused: data.isPaused,
            adChanged,
            isInitialSync
          });
        }
        
        // ✅ FIXED: Always sync on initial connection OR when ad changes OR when position drift detected
        // This ensures Slot 2 properly syncs when connecting late to Slot 1 and corrects drift from buffering
        const positionDrift = data.currentTime !== undefined && currentVideoPosition !== undefined 
          ? Math.abs(data.currentTime - currentVideoPosition) 
          : 0;
        // ✅ FIX: Set drift threshold to 0.5 seconds to balance sync accuracy with stability
        // This prevents unnecessary syncs that cause pause/play flicker while keeping slots in sync
        // ✅ CRITICAL FIX: Don't sync to position 0 if master is already playing SAME ad (stale display data)
        // This prevents Slot 2 from restarting when it receives buffering/initial state from master
        // BUT: Always sync if ad changed, even to position 0 (new video starting)
        // ✅ IMPROVED: Check both currentVideoPosition AND lastNonZeroSyncPosition to catch stale data
        // This fixes the issue where currentVideoPosition becomes 0 after a seek, causing stale data check to fail
        const isStaleData = !adChanged && // Not stale if ad changed!
          data.currentTime === 0 && 
          !data.isBuffering && 
          !data.isPaused && 
          (currentVideoPosition !== undefined && currentVideoPosition > 2.0 || // We're already past 2 seconds
           (lastNonZeroSyncPosition.current !== null && lastNonZeroSyncPosition.current > 2.0)) && // OR we've synced to > 2s before
          isPlaying && // Video is actually playing
          !isInitialSync; // Not the first sync
        // ✅ CRITICAL: Always sync on ad changes to ensure both slots start at same position (even at 0s)
        // Also sync on initial connection or when drift exceeds 0.5 seconds
        // ✅ FIX: Don't sync for drift correction while buffering - this prevents the infinite seek/buffer loop
        // When Slot 2's video is buffering, skip drift correction to avoid constant seeking
        // However, ALWAYS sync on ad changes or initial sync regardless of buffering (these are critical)
        // ✅ CRITICAL FIX: Prevent seek loop - don't sync if we just synced within the last 2 seconds
        // This gives the video time to buffer and start playing before we try to sync again
        const timeSinceLastSync = Date.now() - lastSyncCommandTime.current;
        const isInSyncCooldown = timeSinceLastSync < SYNC_COMMAND_COOLDOWN && !adChanged && !isInitialSync;
        // ✅ ADDITIONAL SAFEGUARD: Don't sync to position 0 if we're already playing past 2 seconds
        // This prevents restarts even if stale data check somehow fails
        const isPosition0Restart = data.currentTime === 0 && 
                                   !adChanged && 
                                   !isInitialSync && 
                                   currentVideoPosition > 2.0 && 
                                   isPlaying;
        // ✅ CRITICAL: Don't sync if seeking has been failing repeatedly
        // This prevents infinite sync loops when seeking doesn't work on the device
        const seekIsBroken = seekFailureCount.current >= MAX_SEEK_FAILURES;
        // ✅ CRITICAL: Don't sync if video is actually playing and advancing (even if not at exact position)
        // This prevents interrupting natural playback when seeking doesn't work
        // Video is "playing naturally" if it's playing, has advanced past 0.5s, and is within reasonable range of master
        // OR if video is playing from start (position 0-2s) and we've had seek failures - let it play naturally
        const isVideoPlayingNaturally = (isPlaying && 
                                       currentVideoPosition > 0.5 && 
                                       currentVideoPosition < data.currentTime + 10.0 && // Within 10s of master
                                       currentVideoPosition > data.currentTime - 2.0) || // Not too far ahead (within 2s behind is OK)
                                       (isPlaying && 
                                        currentVideoPosition < 2.0 && 
                                        seekFailureCount.current >= MAX_SEEK_FAILURES); // If seeking is broken and video is playing from start, let it play
        // ✅ NEW FIX: Increase drift threshold to 0.5s to reduce unnecessary syncs that cause pause/play flicker
        // Only sync for drift if it's significant enough to warrant seeking
        // ✅ CRITICAL: Only allow sync if seeking isn't broken OR if it's an ad change/initial sync (critical syncs)
        // ✅ CRITICAL: Don't sync if video is playing naturally (unless drift is very large > 5s)
        const shouldSyncPosition = !isStaleData && !isPosition0Restart && !isInSyncCooldown && 
                                   (!seekIsBroken || adChanged || isInitialSync) && // Allow critical syncs even if seeking is broken
                                   (!isVideoPlayingNaturally || positionDrift > 5.0 || adChanged || isInitialSync) && // Don't interrupt natural playback unless drift is huge
                                   (adChanged || isInitialSync || (positionDrift > 0.5 && !wasBuffering)); // Allow drift sync only when not in cooldown, not buffering, AND drift > 0.5s
        
        // ✅ NEW: Log when sync is blocked by cooldown or stale data to help debug the seek loop issue
        if (isStaleData) {
          console.log(`⏸️ [Slave Sync] BLOCKED: Stale position 0 data detected - currentPos: ${currentVideoPosition?.toFixed(1)}s, lastNonZeroSync: ${lastNonZeroSyncPosition.current?.toFixed(1)}s, isPlaying: ${isPlaying}`);
        }
        if (isPosition0Restart) {
          console.log(`⏸️ [Slave Sync] BLOCKED: Position 0 restart prevented - currentPos: ${currentVideoPosition?.toFixed(1)}s, isPlaying: ${isPlaying}, adChanged: ${adChanged}`);
        }
        if (seekIsBroken && !adChanged && !isInitialSync) {
          console.log(`⏸️ [Slave Sync] BLOCKED: Seeking is broken (${seekFailureCount.current} failures) - skipping drift correction to prevent loops`);
        }
        if (isVideoPlayingNaturally && positionDrift <= 5.0 && !adChanged && !isInitialSync) {
          console.log(`⏸️ [Slave Sync] BLOCKED: Video playing naturally at ${currentVideoPosition?.toFixed(1)}s (drift ${positionDrift.toFixed(1)}s) - not interrupting playback`);
        }
        if (!isStaleData && !isPosition0Restart && !seekIsBroken && isInSyncCooldown && positionDrift > 0.5 && !adChanged && !isInitialSync) {
          console.log(`⏸️ [Slave Sync] Skipping drift correction (${positionDrift.toFixed(1)}s) - in sync cooldown (${(timeSinceLastSync / 1000).toFixed(1)}s ago, need ${(SYNC_COMMAND_COOLDOWN / 1000).toFixed(1)}s)`);
        }
        
        if (shouldSyncPosition) {
          if (isInitialSync) {
            console.log(`📺 [Slave Initial Sync] First sync from master - syncing to ad ${data.adIndex} at position ${data.currentTime?.toFixed(1)}s`);
            setHasReceivedInitialSync(true);
          } else if (positionDrift > 0.5) {
            console.log(`📺 [Slave Drift Correction] Position drift detected (${positionDrift.toFixed(1)}s) - syncing to master position ${data.currentTime?.toFixed(1)}s`);
          } else {
            console.log(`📺 [Slave Sync] Switching to ad ${data.adIndex} and syncing to position ${data.currentTime?.toFixed(1)}s`);
          }
          
          setCurrentAdIndex(data.adIndex);
          setLastSyncPosition(data.currentTime);
          setLastSyncTime(Date.now());
          // ✅ FIX: Reset lastNonZeroSyncPosition when ad changes (new video starting)
          if (adChanged) {
            lastNonZeroSyncPosition.current = null;
            // ✅ CRITICAL: Reset seek failure count on ad change - new video might work better
            seekFailureCount.current = 0;
            console.log(`🔄 [Slave Sync] Ad changed - resetting seek failure count`);
          }
          
          // ⏳ Wait for slave video to finish buffering before syncing position
          if (data.currentTime !== undefined && videoRef.current) {
            const waitForVideoReady = async () => {
              let attempts = 0;
              const maxAttempts = 20; // Max 2 seconds (20 * 100ms)
              
              // Poll video status until it's fully loaded
              while (attempts < maxAttempts) {
                try {
                  const status = await videoRef.current?.getStatusAsync();
                  
                  if (status && status.isLoaded) {
                    // Video is loaded! Sync position even if still buffering
                    console.log(`✅ [Slave Sync] Video loaded (took ${attempts * 100}ms), syncing to ${data.currentTime?.toFixed(1)}s`);
                    
                    // ✅ CRITICAL FIX: If we've failed too many seeks, don't try again - let video play naturally
                    if (seekFailureCount.current >= MAX_SEEK_FAILURES) {
                      console.warn(`⚠️ [Slave Sync] Too many seek failures (${seekFailureCount.current}), skipping sync - letting video play naturally`);
                      // Reset failure count after 10 seconds to allow retry
                      setTimeout(() => {
                        if (seekFailureCount.current >= MAX_SEEK_FAILURES) {
                          console.log(`🔄 [Slave Sync] Resetting seek failure count after timeout`);
                          seekFailureCount.current = 0;
                        }
                      }, 10000);
                      break;
                    }
                    
                    try {
                      // ✅ CRITICAL FIX: Pause video before seeking (some devices need this)
                      const wasPlaying = status.isPlaying;
                      if (wasPlaying && videoRef.current) {
                        await videoRef.current.pauseAsync().catch(() => {}); // Ignore errors
                        await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
                      }
                      
                      // Perform the seek
                      await videoRef.current?.setPositionAsync(data.currentTime * 1000);
                      
                      // ✅ CRITICAL FIX: Wait longer and verify multiple times
                      // Some devices need more time for seek to complete
                      let seekSuccessful = false;
                      for (let verifyAttempt = 0; verifyAttempt < 5; verifyAttempt++) {
                        await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms between checks
                        
                        const verifyStatus = await videoRef.current?.getStatusAsync();
                        if (verifyStatus && verifyStatus.isLoaded) {
                          const actualPosition = verifyStatus.positionMillis ? verifyStatus.positionMillis / 1000 : 0;
                          const expectedPosition = data.currentTime;
                          const positionError = Math.abs(actualPosition - expectedPosition);
                          
                          if (positionError < 1.5) {
                            // Position is close enough - seek worked!
                            console.log(`✅ [Slave Sync] Position verified after ${verifyAttempt + 1} attempts: ${actualPosition.toFixed(1)}s (expected ${expectedPosition.toFixed(1)}s, error ${positionError.toFixed(2)}s)`);
                            setCurrentVideoPosition(actualPosition);
                            if (actualPosition > 0) {
                              lastNonZeroSyncPosition.current = actualPosition;
                            }
                            seekFailureCount.current = 0; // Reset failure count on success
                            lastSuccessfulSeekTime.current = Date.now();
                            seekSuccessful = true;
                            break;
                          } else if (verifyAttempt === 4) {
                            // Last attempt failed
                            console.warn(`⚠️ [Slave Sync] Position mismatch after 5 attempts: got ${actualPosition.toFixed(1)}s, expected ${expectedPosition.toFixed(1)}s`);
                            seekFailureCount.current++;
                            
                            // If position is still 0, it might be a fundamental issue - don't update position tracking
                            if (actualPosition < 0.5) {
                              console.warn(`⚠️ [Slave Sync] Video stuck at position 0 - seek may not be working on this device`);
                              // Don't update currentVideoPosition - let it stay at what it was
                            } else {
                              // Position changed but not to target - update anyway
                              setCurrentVideoPosition(actualPosition);
                            }
                          }
                        }
                      }
                      
                      // If seek failed, try one more aggressive approach: pause, seek, wait longer, then play
                      if (!seekSuccessful && seekFailureCount.current < MAX_SEEK_FAILURES) {
                        console.log(`🔄 [Slave Sync] Attempting aggressive seek recovery...`);
                        if (videoRef.current) {
                          await videoRef.current.pauseAsync().catch(() => {});
                          await new Promise(resolve => setTimeout(resolve, 200));
                          await videoRef.current.setPositionAsync(data.currentTime * 1000);
                          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                          
                          const finalStatus = await videoRef.current?.getStatusAsync();
                          if (finalStatus && finalStatus.isLoaded && finalStatus.positionMillis) {
                            const finalPosition = finalStatus.positionMillis / 1000;
                            const finalError = Math.abs(finalPosition - data.currentTime);
                            if (finalError < 2.0) {
                              console.log(`✅ [Slave Sync] Aggressive seek recovery successful: ${finalPosition.toFixed(1)}s`);
                              setCurrentVideoPosition(finalPosition);
                              if (finalPosition > 0) {
                                lastNonZeroSyncPosition.current = finalPosition;
                              }
                              seekFailureCount.current = 0;
                              lastSuccessfulSeekTime.current = Date.now();
                              seekSuccessful = true;
                            }
                          }
                        }
                      }
                      
                      lastSyncCommandTime.current = Date.now(); // ✅ FIX: Track sync time to prevent immediate re-sync during buffering
                      
                      // ✅ FIX: Always try to play if master is playing, even if buffering
                      // This ensures Slot 2 starts playing as soon as possible
                      // ✅ FIX: Don't throttle on ad changes or initial sync - immediate playback needed
                      if (!data.isPaused) {
                        const now = Date.now();
                        const skipThrottle = adChanged || isInitialSync; // No throttle on ad changes or initial sync
                        if (skipThrottle || now - lastPlayCommandTime.current >= PLAY_COMMAND_THROTTLE) {
                          lastPlayCommandTime.current = now;
                          await videoRef.current?.playAsync();
                          console.log(`▶️ [Slave Sync] Video play command sent${skipThrottle ? ' (immediate)' : ''}`);
                          
                          // ✅ CRITICAL FIX: Start persistent playback enforcer for Slot 2 after ANY seek/sync
                          // This ensures video actually starts playing and doesn't get stuck at position 0
                          if (slotNumber === 2) {
                            console.log(`🔄 [Slave Sync] Starting playback enforcer for ad ${data.adIndex} (after sync)`);
                            startPlaybackEnforcer(data.adIndex);
                          }
                        } else {
                          console.log(`⏭️ [Slave Sync] Skipping play command (throttled)`);
                        }
                      }
                    } catch (syncErr) {
                      console.warn(`⚠️ [Slave Sync] Error syncing position:`, syncErr);
                    }
                    
                    // If video is not buffering, we're done
                    if (!status.isBuffering) {
                      break;
                    }
                  }
                  
                  // Still buffering, wait 100ms and check again
                  await new Promise(resolve => setTimeout(resolve, 100));
                  attempts++;
                  
                  if (attempts % 5 === 0) {
                    console.log(`⏳ [Slave Sync] Still buffering... (${attempts * 100}ms elapsed)`);
                  }
                } catch (err) {
                  console.warn(`⚠️ [Slave Sync] Error checking video status:`, err);
                  break;
                }
              }
              
              if (attempts >= maxAttempts) {
                console.warn(`⚠️ [Slave Sync] Buffering timeout after ${maxAttempts * 100}ms, syncing anyway`);
                
                // Skip if too many failures
                if (seekFailureCount.current >= MAX_SEEK_FAILURES) {
                  console.warn(`⚠️ [Slave Sync] Skipping timeout sync - too many seek failures`);
                  return; // Exit the async function
                }
                
                try {
                  // Pause before seeking
                  if (videoRef.current) {
                    await videoRef.current.pauseAsync().catch(() => {});
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                  
                  await videoRef.current?.setPositionAsync(data.currentTime * 1000);
                  
                  // ✅ CRITICAL FIX: Wait longer and verify after timeout seek
                  await new Promise(resolve => setTimeout(resolve, 500));
                  const timeoutStatus = await videoRef.current?.getStatusAsync();
                  if (timeoutStatus && timeoutStatus.isLoaded && timeoutStatus.positionMillis) {
                    const actualPosition = timeoutStatus.positionMillis / 1000;
                    const positionError = Math.abs(actualPosition - data.currentTime);
                    
                    if (positionError < 2.0) {
                      setCurrentVideoPosition(actualPosition);
                      if (actualPosition > 0) {
                        lastNonZeroSyncPosition.current = actualPosition;
                      }
                      seekFailureCount.current = 0;
                      lastSuccessfulSeekTime.current = Date.now();
                      console.log(`✅ [Slave Sync] Timeout sync verified: position ${actualPosition.toFixed(1)}s`);
                    } else {
                      console.warn(`⚠️ [Slave Sync] Timeout sync failed: got ${actualPosition.toFixed(1)}s, expected ${data.currentTime.toFixed(1)}s`);
                      seekFailureCount.current++;
                      // Don't update position if it's still wrong
                    }
                  } else {
                    seekFailureCount.current++;
                  }
                  lastSyncCommandTime.current = Date.now(); // ✅ FIX: Track sync time to prevent immediate re-sync during buffering
                  
                  // ✅ FIX: Try to play even on timeout - don't throttle on ad changes or initial sync
                  if (!data.isPaused && videoRef.current) {
                    const now = Date.now();
                    const skipThrottle = adChanged || isInitialSync; // No throttle on ad changes or initial sync
                    if (skipThrottle || now - lastPlayCommandTime.current >= PLAY_COMMAND_THROTTLE) {
                      lastPlayCommandTime.current = now;
                      await videoRef.current?.playAsync();
                      console.log(`▶️ [Slave Sync] Video play command sent (timeout)${skipThrottle ? ' (immediate)' : ''}`);
                      
                      // ✅ CRITICAL FIX: Start persistent playback enforcer for Slot 2 after timeout sync
                      if (slotNumber === 2) {
                        console.log(`🔄 [Slave Sync] Starting playback enforcer for ad ${data.adIndex} (after timeout)`);
                        startPlaybackEnforcer(data.adIndex);
                      }
                    } else {
                      console.log(`⏭️ [Slave Sync] Skipping play command on timeout (throttled)`);
                    }
                  }
                } catch (err) {
                  console.warn(`⚠️ [Slave Sync] Error on timeout sync:`, err);
                }
              }
            };
            
            waitForVideoReady().catch(err => {
              console.error('❌ [Slave Sync] Error waiting for video ready:', err);
            });
          }
        }
        
        // ✅ FIX: Update playback state (pause/resume) - but throttle to prevent rapid toggling
        // Only update if state actually changed and enough time has passed
        // Also skip if slot sync is currently handling it (to prevent conflicts)
        if (data.isPaused !== undefined && !isSyncingSlot2.current) {
          const now = Date.now();
          const stateChanged = data.isPaused !== isPaused;
          const enoughTimePassed = now - lastPauseStateUpdate.current >= PAUSE_STATE_UPDATE_THROTTLE;
          
          // Only update if state changed AND enough time has passed (throttle)
          if (stateChanged && enoughTimePassed) {
            const wasPaused = isPaused;
            console.log(`📺 [Display Data] Updating pause state: ${isPaused} -> ${data.isPaused}`);
            setIsPaused(data.isPaused);
            lastPauseStateUpdate.current = now;
            
            // ✅ NEW: Update shouldBePlayingRef to control playback enforcer
            if (slotNumber === 2) {
              shouldBePlayingRef.current = !data.isPaused;
              if (data.isPaused) {
                // Stop enforcer when paused
                stopPlaybackEnforcer();
              }
            }
            
            // ✅ FIX: Always try to play/pause immediately, don't wait for state update
            // This ensures Slot 2 responds quickly to master's state changes
            if (videoRef.current) {
              if (data.isPaused) {
                videoRef.current.pauseAsync().catch(err => {
                  console.warn('⚠️ [Slave Sync] Error pausing video:', err);
                });
              } else {
                // ✅ FIX: Force play immediately, especially if video was paused
                // This fixes slow playback issues
                // ✅ FIX: Don't throttle on ad changes - immediate playback needed
                const playNow = Date.now();
                const skipThrottle = adChanged; // No throttle on ad changes
                if (skipThrottle || playNow - lastPlayCommandTime.current >= PLAY_COMMAND_THROTTLE) {
                  lastPlayCommandTime.current = playNow;
                  videoRef.current.playAsync().catch(err => {
                    console.warn('⚠️ [Slave Sync] Error playing video:', err);
                  });
                } else {
                  console.log(`⏭️ [Slave Sync] Skipping play command (throttled)`);
                }
                
                // If video was paused and now should play, log it
                if (wasPaused && !data.isPaused) {
                  console.log(`▶️ [Slave Sync] Resuming playback - master is playing`);
                }
              }
            }
          } else if (!stateChanged && !data.isPaused && !isPaused && videoRef.current) {
            // State hasn't changed and both should be playing - ensure video is actually playing
            // Only do this occasionally to avoid spamming play commands
            if (Math.random() < 0.1) { // Only 10% of the time
              videoRef.current.playAsync().catch(err => {
                // Ignore - video might already be playing
              });
            }
          }
        } else if (!isPaused && videoRef.current && !isSyncingSlot2.current) {
          // ✅ FIX: If pause state not provided but we're not paused, ensure video is playing
          // This handles cases where display data doesn't include pause state
          // Only do this occasionally to avoid spamming play commands
          if (Math.random() < 0.1) { // Only 10% of the time
            videoRef.current.playAsync().catch(err => {
              // Ignore - video might already be playing
            });
          }
        }
      }
      
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling display data:', error);
    }
  };

  // Handle lockdown command from server
  const handleLockdown = (message: any) => {
    try {
      console.log('🔒 [AdPlayer] Received lockdown command:', message);
      console.log('🔒 [AdPlayer] Current isLocked state:', isLocked);
      
      // Lock the screen - prevent user interaction but keep ads playing
      onLockStateChange?.(true);
      // Note: We don't pause the video - ads should continue playing
      
      console.log('🔒 [AdPlayer] Screen locked - user interaction disabled, ads continue playing');
      console.log('🔒 [AdPlayer] Device remains ONLINE - admin can still monitor and unlock');
      console.log('🔒 [AdPlayer] New isLocked state:', true);
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling lockdown:', error);
    }
  };

  // Handle unlock command from server - use useCallback to ensure latest onLockStateChange is used
  const handleUnlock = useCallback((message: any) => {
    try {
      console.log('🔓 [AdPlayer] Received unlock command:', message);
      console.log('🔓 [AdPlayer] Current isLocked state:', isLocked);
      
      // Unlock the screen - allow user interaction again
      onLockStateChange?.(false);
      // Note: Video continues playing normally - no need to resume
      
      console.log('🔓 [AdPlayer] Screen unlocked - user interaction enabled');
      console.log('🔓 [AdPlayer] New isLocked state:', false);
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling unlock:', error);
    }
  }, [isLocked, onLockStateChange]);

  // Handle 8-hour completion stop command from server
  const handleStop8Hours = async (message: any) => {
    try {
      console.log('🛑 [AdPlayer] Received 8-hour completion STOP command:', message);
      console.log(`🎉 Congratulations! You completed ${message.totalHours?.toFixed(2)} hours`);
      console.log(`🔒 Ad player will be locked until ${message.unlockTime}`);
      
      // 1. Stop GPS tracking
      console.log('📍 [AdPlayer] Stopping GPS tracking...');
      adaptiveGPSService.stopTracking();
      
      // 2. Stop ad playback
      console.log('⏸️ [AdPlayer] Stopping ad playback...');
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(err => {
          console.log('⏸️ [AdPlayer] Video pause error (expected):', err.message);
        });
      }
      
      // 3. Clear current ad and pause playback
      // Note: currentAd is computed from currentAdIndex, so we just pause
      setIsPlaying(false);
      setIsPaused(true);
      
      // 4. Lock the screen and set device offline
      console.log('🔒 [AdPlayer] Locking ad player...');
      onLockStateChange?.(true);
      
      // Set device status to offline when locked for 8-hour completion
      console.log('🔒 [AdPlayer] Setting device status to OFFLINE (8-hour completion)');
      await tabletRegistrationService.updateTabletStatus(false, { lat: 0, lng: 0 });
      console.log('🔒 [AdPlayer] Device now appears OFFLINE in admin dashboard');
      
      // 5. Show completion alert
      Alert.alert(
        '🎉 8 Hours Completed!',
        `Congratulations! You have completed your 8-hour daily requirement.\n\nTotal Hours: ${message.totalHours?.toFixed(2)} hours\n\nThe ad player is now locked until ${message.unlockTime}.\n\nThank you for your service!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to home screen or close app
              console.log('✅ [AdPlayer] User acknowledged 8-hour completion');
            }
          }
        ],
        { cancelable: false }
      );
      
      console.log('✅ [AdPlayer] 8-hour completion sequence complete');
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling 8-hour stop:', error);
    }
  };

  // Handle company ads only mode command from server (when 8 hours reached)
  const handleCompanyAdsOnly = async (message: any) => {
    try {
      console.log('🏢 [AdPlayer] Received company ads only mode command:', message);
      console.log(`🎉 Congratulations! You completed ${message.totalHours?.toFixed(2)} hours`);
      console.log(`🏢 Switching to company ads only mode - will lock at ${message.lockTime}`);
      
      // Enable company ads only mode
      setIsCompanyAdsOnlyMode(true);
      
      // ✅ NEW: Stop ad playback tracking (hours and ad analytics)
      console.log('⏸️ [AdPlayer] Stopping ad playback tracking - only location/GPS will be tracked');
      
      // Stop WebSocket playback updates (no more ad tracking)
      playbackWebSocketService.stopPlaybackUpdates();
      console.log('⏸️ [AdPlayer] WebSocket playback updates stopped');
      
      // Switch to company ad immediately (if currently showing user ad)
      if (currentAdIndex >= 0 && companyAds.length > 0) {
        console.log('🔄 [AdPlayer] Switching to company ad immediately');
        setCurrentAdIndex(-1); // -1 indicates company ad
        setCompanyAdRepeatIndex(0);
      }
      
      // Show notification (non-blocking alert)
      Alert.alert(
        '🎉 8 Hours Completed!',
        `Congratulations! You have completed your 8-hour daily requirement.\n\nTotal Hours: ${message.totalHours?.toFixed(2)} hours\n\nThe ad player will now show only company ads until ${message.lockTime}.\n\nNote: Hours and ad playback tracking have stopped. Only location tracking continues.\n\nThank you for your service!`,
        [{ text: 'OK' }],
        { cancelable: false }
      );
      
      console.log('✅ [AdPlayer] Company ads only mode enabled - will continue playing company ads');
      console.log('⏸️ [AdPlayer] Ad playback tracking stopped - location/GPS tracking continues');
      console.log(`⏰ [AdPlayer] Device will lock at ${message.lockTime} due to time-based lock`);
    } catch (error) {
      console.error('❌ [AdPlayer] Error handling company ads only mode:', error);
    }
  };

  // ✨ NEW: Handle refresh ads command from server (when ads are moved/removed)
  const handleRefreshAds = async (message: any) => {
    try {
      console.log('🔄 [AdPlayer] Received refresh ads command:', message);
      console.log(`🔄 [AdPlayer] Reason: ${message.reason || 'adsUpdated'}`);
      
      // Store current ad info before refresh to check if it still exists
      const currentAdBeforeRefresh = ads[currentAdIndex];
      const currentAdId = currentAdBeforeRefresh?.adId;
      
      // Reset the fetch flag to allow refetching
      hasFetchedInitialAds.current = false;
      
      // Refetch ads and company ads
      console.log('🔄 [AdPlayer] Refetching ads...');
      await Promise.all([
        fetchAds(),
        fetchCompanyAds()
      ]);
      
      // After refresh, check if the current ad still exists
      // fetchAds() will reset currentAdIndex to 0, so we need to check the new ads list
      // The video will automatically switch to the new ad at index 0
      // If we want to maintain the same ad if it still exists, we could do:
      // const newAdIndex = ads.findIndex(ad => ad.adId === currentAdId);
      // if (newAdIndex !== -1) {
      //   setCurrentAdIndex(newAdIndex);
      // }
      // But resetting to 0 is safer and simpler - it ensures we start from the beginning
      
      console.log('✅ [AdPlayer] Ads refreshed successfully');
      if (currentAdId && !ads.find(ad => ad.adId === currentAdId)) {
        console.log(`ℹ️ [AdPlayer] Previous ad (${currentAdId}) was removed, starting from first ad`);
      }
    } catch (error) {
      console.error('❌ [AdPlayer] Error refreshing ads:', error);
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
            sendPlaybackUpdate({
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

  // ❌ REMOVED: Per-second playback updates (not needed for progress bar)
  // Helper function to send playback updates - DEPRECATED
  const sendPlaybackUpdate = (playbackData: any) => {
    // ✅ NEW: Skip playback updates if in company-ads-only mode (after 8 hours)
    if (isCompanyAdsOnlyMode) {
      // Silent skip - no playback tracking in company-ads-only mode
      return;
    }
    
    // No-op: Playback updates have been disabled
    return;
  };

  // Track ad playback
  const trackAdPlayback = async (adId: string, adTitle: string, adDuration: number, viewTime: number = 0) => {
    try {
      // ✅ NEW: Skip ad tracking if in company-ads-only mode (after 8 hours)
      if (isCompanyAdsOnlyMode) {
        console.log(`⏸️ [AdPlayer] Skipping ad tracking - company-ads-only mode (8 hours completed)`);
        return;
      }
      
      // Slot 2 in mirror mode: NEVER send analytics
      if (slotNumber === 2 && masterConnected) {
        // Silent skip - Slot 2 is just mirroring
        return;
      }
      
      // Slot 1 always sends analytics
      // Slot 2 only sends analytics in failover mode (when master is offline)
      if (slotNumber === 2 && !masterConnected) {
        console.log('⚡ [AdPlayer] Slot 2 FAILOVER - Tracking analytics because master is offline');
      }

      // Skip ad tracking if paused
      if (isPaused) {
        console.log(`⏸️ [AdPlayer] Skipping ad tracking - video is paused`);
        return;
      }
      
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

      // ✅ SINGLE TRACKING CALL: Send to deviceTracking endpoint which properly saves to database
      // This prevents duplicate tracking (was sending 3x before: queue, analytics, and registration service)
      
      // Send to analytics service
      const analyticsData = {
        deviceId: registrationData?.deviceId || await tabletRegistrationService.generateDeviceId(),
        deviceSlot: slotNumber, // Server expects 'deviceSlot' not 'slotNumber'
        adId: adId,
        adTitle: adTitle,
        adDuration: adDuration,
        viewTime: viewTime // Use actual view time instead of 0
      };
      
      // Send to analytics endpoint (handles both online and tracks properly)
      if (!isOffline) {
        try {
          // Use statically imported requestManager
          const analyticsResponse = await requestManager.fetch(`${API_BASE_URL}/deviceTracking/ad-playback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(analyticsData),
            timeout: 10000,
            priority: 2, // Medium priority
            allowDuplicate: false,
          });
          
          if (analyticsResponse.ok) {
            const result = await analyticsResponse.json();
            log.adAnalytics(`Ad playback tracked successfully: ${adTitle}`, result);
            console.log(`✅ Ad playback tracked: ${adTitle}`);
          } else {
            console.log(`❌ Failed to track ad playback in analytics: ${adTitle}`);
          }
        } catch (error) {
          console.error('❌ Error sending analytics data:', error);
          // Queue for later if network error
          await offlineQueueService.queueAdPlayback(adPlaybackData);
        }
      } else {
        // If offline, queue the data for later
        await offlineQueueService.queueAdPlayback(adPlaybackData);
        console.log(`📦 Ad playback queued for offline sync: ${adTitle}`);
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
        // ✅ FIX: Check location services availability first
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          console.log('📍 [QRScan] Location services disabled - skipping GPS data');
        } else {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 1,
              mayShowUserSettingsDialog: false,
            });
            
            if (location && location.coords) {
              gpsData = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                speed: location.coords.speed && location.coords.speed >= 0 ? location.coords.speed : 0,
                heading: location.coords.heading || 0,
                accuracy: location.coords.accuracy || 0,
                altitude: location.coords.altitude || 0
              };
              console.log('📍 [QRScan] GPS data obtained:', gpsData);
            }
          } catch (locationError: any) {
            // ✅ FIX: Handle CoreLocation errors gracefully
            const errorMessage = locationError?.message || String(locationError);
            const errorCode = locationError?.code;
            
            if (errorMessage.includes('kCLErrorDomain') || 
                errorMessage.includes('Cannot obtain current location') ||
                errorCode === 0) {
              // GPS unavailable - this is normal, don't log as warning
              console.log('📍 [QRScan] GPS unavailable - QR scan will continue without location data');
            } else {
              console.warn('⚠️ [QRScan] Could not get GPS location:', errorMessage);
            }
          }
        }
      } catch (error) {
        // Error checking services - continue without GPS data
        console.log('📍 [QRScan] Could not check location services - continuing without GPS data');
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
      // Use requestManager for better error handling (statically imported at top)
      const response = await requestManager.fetch(`${API_BASE_URL}/ads/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(qrScanData),
        timeout: 10000,
        priority: 3, // High priority (QR scans are important)
        allowDuplicate: false,
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
        // ✅ FIX: Check location services availability first
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          console.log('📍 [QRDisplay] Location services disabled - skipping GPS data');
        } else {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 1,
              mayShowUserSettingsDialog: false,
            });
            
            if (location && location.coords) {
              gpsData = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                speed: location.coords.speed && location.coords.speed >= 0 ? location.coords.speed : 0,
                heading: location.coords.heading || 0,
                accuracy: location.coords.accuracy || 0,
                altitude: location.coords.altitude || 0
              };
              console.log('📍 [QRDisplay] GPS data obtained:', gpsData);
            }
          } catch (locationError: any) {
            // ✅ FIX: Handle CoreLocation errors gracefully
            const errorMessage = locationError?.message || String(locationError);
            const errorCode = locationError?.code;
            
            if (errorMessage.includes('kCLErrorDomain') || 
                errorMessage.includes('Cannot obtain current location') ||
                errorCode === 0) {
              // GPS unavailable - this is normal, don't log as warning
              console.log('📍 [QRDisplay] GPS unavailable - QR display will continue without location data');
            } else {
              console.warn('⚠️ [QRDisplay] Could not get GPS location:', errorMessage);
            }
          }
        }
      } catch (error) {
        // Error checking services - continue without GPS data
        console.log('📍 [QRDisplay] Could not check location services - continuing without GPS data');
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
      // Use requestManager for better error handling (statically imported at top)
      const deviceTrackingResponse = await requestManager.fetch(`${API_BASE_URL}/deviceTracking/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: registrationData?.deviceId || await tabletRegistrationService.generateDeviceId(),
          deviceSlot: adSlotNumber,
          qrScanData: qrDisplayData
        }),
        timeout: 10000,
        priority: 3, // High priority (QR display tracking is important)
        allowDuplicate: false,
      });

      if (deviceTrackingResponse.ok) {
        console.log(`✅ QR display tracked in device tracking: ${adTitle}`);
      } else {
        console.log(`❌ Failed to track QR display in device tracking: ${adTitle}`);
      }

      // Also send to existing QR scan tracking endpoint for backward compatibility
      const response = await requestManager.fetch(`${API_BASE_URL}/ads/qr-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(qrDisplayData),
        timeout: 10000,
        priority: 3, // High priority (QR scans are important)
        allowDuplicate: false,
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
  
  // Weighted random selection for company ads based on priority
  const selectWeightedCompanyAd = (ads: CompanyAd[]): CompanyAd | null => {
    if (ads.length === 0) return null;
    if (ads.length === 1) return ads[0];
    
    // Filter currently active ads based on scheduling
    const now = new Date();
    const activeAds = ads.filter(ad => {
      if (!ad.isScheduled || ad.scheduleType === 'IMMEDIATE') {
        return ad.isActive;
      }
      if (ad.scheduleType === 'SCHEDULED') {
        const startDate = ad.startDate ? new Date(ad.startDate) : null;
        const endDate = ad.endDate ? new Date(ad.endDate) : null;
        if (!startDate && !endDate) {
          return ad.isActive;
        }
        const isAfterStart = !startDate || now >= startDate;
        const isBeforeEnd = !endDate || now <= endDate;
        return isAfterStart && isBeforeEnd;
      }
      return ad.isActive;
    });
    
    if (activeAds.length === 0) return null;
    if (activeAds.length === 1) return activeAds[0];
    
    // Calculate weights based on priority (minimum weight of 1)
    const weights = activeAds.map(ad => Math.max(1, ad.priority));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Generate random number
    let random = Math.random() * totalWeight;
    
    // Select ad based on weight
    for (let i = 0; i < activeAds.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        console.log(`🎯 Selected company ad "${activeAds[i].title}" with priority ${activeAds[i].priority} (weight: ${weights[i]})`);
        return activeAds[i];
      }
    }
    
    // Fallback to last ad
    return activeAds[activeAds.length - 1];
  };
  
  // Determine which ad to show
  const currentAd = currentAdIndex === -1 ? 
    (companyAds.length > 0 ? (() => {
      const selectedCompanyAd = selectWeightedCompanyAd(companyAds);
      return selectedCompanyAd ? {
        adId: selectedCompanyAd.id,
        adTitle: selectedCompanyAd.title,
        mediaFile: selectedCompanyAd.mediaFile,
        duration: selectedCompanyAd.duration
      } : null;
    })() : null) : 
    (ads[currentAdIndex] || null);
  
  // 🔍 DEBUG: Log currentAd changes to help diagnose playback issues
  useEffect(() => {
    if (currentAd) {
      console.log(`🎬 [CurrentAd] Current ad set:`, {
        adTitle: currentAd.adTitle,
        adId: currentAd.adId,
        mediaFile: currentAd.mediaFile,
        currentAdIndex,
        isPaused,
        totalAds: ads.length,
        hasMediaFile: !!currentAd.mediaFile
      });
    } else {
      console.log(`🎬 [CurrentAd] No current ad`, {
        currentAdIndex,
        adsLength: ads.length,
        companyAdsLength: companyAds.length
      });
    }
  }, [currentAd, currentAdIndex, ads.length, companyAds.length, isPaused]);
  
  // 🔍 DEBUG: Force video playback start when currentAd is ready
  useEffect(() => {
    if (currentAd && currentAd.mediaFile && !isPaused && videoRef.current) {
      // Wait a bit for the Video component to mount and start loading
      const checkVideoStatus = setInterval(async () => {
        try {
          const status = await videoRef.current?.getStatusAsync();
          if (status) {
            if (status.isLoaded && !status.isPlaying) {
              console.log(`🎬 [Auto-Play] Video is loaded but not playing - forcing playback start`);
              clearInterval(checkVideoStatus);
              await videoRef.current?.playAsync();
            } else if (!status.isLoaded && status.error) {
              console.error(`🎬 [Auto-Play] Video has error:`, status.error);
              clearInterval(checkVideoStatus);
            }
          } else {
            console.log(`🎬 [Auto-Play] Video status is null - component may not be mounted yet`);
          }
        } catch (err) {
          console.log(`🎬 [Auto-Play] Error checking video status:`, err);
        }
      }, 500); // Check every 500ms
      
      // Stop checking after 10 seconds
      const timeout = setTimeout(() => {
        clearInterval(checkVideoStatus);
        console.log(`🎬 [Auto-Play] Stopped checking video status after 10 seconds`);
      }, 10000);
      
      return () => {
        clearInterval(checkVideoStatus);
        clearTimeout(timeout);
      };
    }
  }, [currentAd, isPaused]);
  
  useEffect(() => {
    if (currentAd && currentAdIndex >= 0 && !isOffline && !trackedAds.has(currentAd.adId)) {
      // Note: QR display tracking is now handled by the tracking page when users scan
      // Only log QR display occasionally to reduce noise
      if (Math.random() < 0.4) { // Log ~40% of QR displays
        log.deviceTracking('QR code displayed', { adTitle: currentAd.adTitle });
      }
      setTrackedAds(prev => new Set(prev).add(currentAd.adId));
    }
  }, [currentAd?.adId, currentAdIndex, isOffline, trackedAds]);

  // Handle QR code interaction (for debugging - simulates when someone scans the QR code)
  const handleQRInteraction = async () => {
    if (currentAd) {
      console.log(`🔍 DEBUG: Simulating QR code scan for ad: ${currentAd.adTitle}`);
      console.log(`🔍 Ad ID: ${currentAd.adId}`);
      console.log(`🔍 Material ID: ${materialId}`);
      console.log(`🔍 Slot Number: ${slotNumber}`);
      console.log(`🔍 Website: ${(currentAd as any).website}`);
      console.log(`🔍 QR URL: ${generateQRData()}`);
      
      // Test QR scan tracking
      await trackQRDisplay(currentAd.adId, currentAd.adTitle);
      
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
      
      // Use the tracking server to track QR scans
      const advertiserWebsite = (currentAd as any).website;
      const fallbackUrl = 'https://ads2go.app';
      
      // Use advertiser website if available, otherwise use fallback
      const redirectUrl = advertiserWebsite || fallbackUrl;
      
      // Only log QR generation occasionally to reduce noise
      if (Math.random() < 0.3) { // Log ~30% of QR generations
        log.deviceTracking('QR code generated', {
          adTitle: currentAd.adTitle,
          hasWebsite: !!advertiserWebsite,
          adSlotNumber: adSlotNumber
        });
      }
      
      const trackingUrl = `${API_BASE_URL}/qr-track.html?` + new URLSearchParams({
        ad_id: currentAd.adId,
        ad_title: currentAd.adTitle || `Ad ${currentAd.adId}`,
        material_id: materialId,
        slot_number: adSlotNumber.toString(),
        website: advertiserWebsite || 'Ads2Go Platform',
        redirect_url: redirectUrl,
        scan_time: Date.now().toString()
      }).toString();
      
      // Only log tracking URL occasionally to reduce noise
      if (Math.random() < 0.2) { // Log ~20% of tracking URLs
        log.deviceTracking('Tracking URL created', { 
          adTitle: currentAd.adTitle,
          adId: currentAd.adId 
        });
      }
      
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
        
        // ✅ Track with ACTUAL view time at the end (not at start with viewTime=0)
        await trackAdPlayback(currentAd.adId, currentAd.adTitle, currentAd.duration, viewTime);
      }
    } catch (error) {
      console.error('Error ending ad playback:', error);
    }
  };

  // Check network connectivity
  const checkNetworkStatus = async () => {
    try {
      // First check if we can reach the server directly
      // Use statically imported tabletRegistrationService (no dynamic import needed)
      const serverAccessible = await tabletRegistrationService.checkServerAccessibility();
      
      if (serverAccessible === 'skipped') {
        // Server check was skipped because app is in background - assume online
        setNetworkStatus(true);
        return true;
      }
      
      if (serverAccessible) {
        console.log('🎬 [AD_PLAYBACK] Server is accessible, network is online');
        setNetworkStatus(true);
        return true;
      }
      
      // Fallback to NetInfo if server check fails
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected && state.isInternetReachable;
      console.log('🎬 [AD_PLAYBACK] NetInfo check:', { isConnected, isInternetReachable: state.isInternetReachable });
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
        
        // ✅ FIX: For cached ads, skip validation if URLs were recently validated
        // This prevents filtering out valid cached ads when app state is transitioning
        const shouldValidate = AppState.currentState === 'active';
        
        if (shouldValidate) {
          // Only validate if app is active - otherwise trust the cache
          const validCachedAds = await filterValidAds(parsedAds);
          
          if (validCachedAds.length > 0) {
            setAds(validCachedAds);
            setCurrentAdIndex(0);
            console.log('✅ Loaded valid cached ads:', validCachedAds.length);
            return true;
          } else {
            // ✅ FIX: If validation filtered out all ads but app might be in transition, use cached ads anyway
            console.log('⚠️ [CacheLoad] Validation filtered out all cached ads - using cached ads anyway (might be app state issue)');
            setAds(parsedAds);
            setCurrentAdIndex(0);
            console.log('✅ Loaded cached ads (bypassed validation):', parsedAds.length);
            return true;
          }
        } else {
          // ✅ FIX: App not active - trust the cache and skip validation
          console.log('📍 [CacheLoad] App not active, using cached ads without validation');
          setAds(parsedAds);
          setCurrentAdIndex(0);
          console.log('✅ Loaded cached ads (no validation):', parsedAds.length);
          return true;
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
  // ✅ FIX: Cache validation results to avoid re-validating URLs
  const urlValidationCache = new Map<string, { isValid: boolean; timestamp: number }>();
  const VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const validateVideoUrl = async (url: string): Promise<boolean> => {
    try {
      // ✅ FIX: Check cache first - don't re-validate URLs that were recently validated
      const cached = urlValidationCache.get(url);
      if (cached && Date.now() - cached.timestamp < VALIDATION_CACHE_TTL) {
        return cached.isValid;
      }

      // ✅ FIX: Skip validation if we're currently resuming from background
      if (isResumingFromBackground.current) {
        console.log('📍 [VideoValidation] Skipping validation during background resume, using cache or assuming valid');
        if (cached) {
          return cached.isValid;
        }
        return true; // Assume valid during resume to avoid blocking playback
      }

      // ✅ FIX: Wait a bit if app just became active to ensure state is fully updated
      if (AppState.currentState !== 'active') {
        // App is not active - wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 500));
        if (AppState.currentState !== 'active') {
          // Still not active - use cached validation if available, otherwise assume valid
          if (cached) {
            return cached.isValid;
          }
          // No cache - assume valid to avoid filtering out all ads
          console.log('📍 [VideoValidation] App not active, assuming URL is valid:', url);
          return true;
        }
      }

      // ✅ FIX: Allow validation even during brief state transitions, but catch cancellation errors
      const response = await requestManager.fetch(url, { 
        method: 'HEAD',
        timeout: 5000,
        priority: 1,
        allowDuplicate: false,
        allowInBackground: true, // ✅ FIX: Allow validation even if app state is briefly inactive
      } as any);
      
      const isValid = response.ok;
      
      // ✅ FIX: Cache the result
      urlValidationCache.set(url, { isValid, timestamp: Date.now() });
      
      return isValid;
    } catch (error: any) {
      // ✅ FIX: Handle all types of cancellation errors gracefully
      const errorMessage = error?.message || String(error);
      const errorName = error?.name || '';
      
      // Check for various cancellation/abort error patterns
      const isCancellationError = 
        (error as any)?.isCancelled === true ||
        (error as any)?.isExpected === true ||
        (error as any)?.isNetworkError === true ||
        errorName === 'AbortError' ||
        errorName === 'TypeError' && (errorMessage.includes('Network request failed') || errorMessage.includes('network request failed') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) ||
        errorMessage.includes('AbortError') ||
        errorMessage.includes('App is in background') || 
        errorMessage.includes('app in background') ||
        errorMessage.includes('request cancelled') ||
        errorMessage.includes('Request cancelled') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('Cancelled') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('network request failed') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('default') ||
        errorMessage.includes('undefined');
      
      if (isCancellationError) {
        // Request was cancelled (likely due to app state change) - check cache or assume valid
        const cached = urlValidationCache.get(url);
        if (cached) {
          console.log('📍 [VideoValidation] Request cancelled, using cached validation result:', cached.isValid);
          return cached.isValid;
        }
        // No cache - assume valid to avoid filtering out all ads
        // This is safe because we only validate when necessary, and cancelled requests don't mean the URL is invalid
        console.log('📍 [VideoValidation] Request cancelled (no cache), assuming URL is valid:', url.substring(0, 50));
        return true;
      }
      
      // For other errors (network errors, etc.), log but assume valid to avoid blocking playback
      console.log('📍 [VideoValidation] Validation error (non-cancellation), assuming valid:', url.substring(0, 50), errorMessage);
      
      // ✅ FIX: Don't cache failed validation if it's a network error - might be temporary
      // Only cache if we're sure the URL is actually invalid (not just a network issue)
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        urlValidationCache.set(url, { isValid: false, timestamp: Date.now() });
        return false;
      }
      
      // For other errors, assume valid but don't cache
      return true;
    }
  };

  // Filter out invalid ads
  const filterValidAds = async (adsToFilter: Ad[]): Promise<Ad[]> => {
    const validAds: Ad[] = [];
    
    // ✅ FIX: If app is not active, wait a bit for state to stabilize
    if (AppState.currentState !== 'active') {
      console.log('📍 [AdFilter] App not active, waiting for state to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    for (const ad of adsToFilter) {
      if (ad.mediaFile && ad.mediaFile.trim() !== '') {
        try {
          const isValid = await validateVideoUrl(ad.mediaFile);
          if (isValid) {
            validAds.push(ad);
          } else {
            // ✅ FIX: Only skip if we're sure the URL is invalid (not just due to app state)
            const cached = urlValidationCache.get(ad.mediaFile);
            if (cached && !cached.isValid) {
              console.log('Skipping invalid video URL (confirmed invalid):', ad.mediaFile);
            } else {
              // Validation failed but might be due to app state - include the ad anyway
              console.log('📍 [AdFilter] Validation failed but assuming valid (app state issue):', ad.mediaFile);
              validAds.push(ad);
            }
          }
        } catch (error) {
          // ✅ FIX: If validation throws an error, assume valid to avoid filtering out all ads
          console.log('📍 [AdFilter] Validation error, assuming valid:', ad.mediaFile, error);
          validAds.push(ad);
        }
      } else {
        // No media file - skip this ad
      }
    }
    
    console.log(`Filtered ${adsToFilter.length} ads to ${validAds.length} valid ads`);
    
    // ✅ FIX: If all ads were filtered out, something is wrong - return original ads
    if (validAds.length === 0 && adsToFilter.length > 0) {
      console.warn('⚠️ [AdFilter] All ads were filtered out - this might be a validation issue. Returning original ads.');
      return adsToFilter;
    }
    
    return validAds;
  };

  // Fetch company ads
  const fetchCompanyAds = async () => {
    try {
      log.adPlayback('Fetching company ads...');
      const result = await companyAdService.fetchActiveCompanyAds();
      
      if (result.success && result.ads.length > 0) {
        setCompanyAds(result.ads);
        console.log(`✅ Loaded ${result.ads.length} company ads`);
      } else {
        console.log('⚠️ No company ads available:', result.message);
        setCompanyAds([]);
      }
    } catch (error) {
      // If request was cancelled (AbortError), silently handle it - this is expected behavior
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('app in background') || error.message.includes('Request cancelled')) {
          // Silently handle - this is expected when app goes to background or request times out
          setCompanyAds([]);
          return;
        }
      }
      // Only log non-cancellation errors if app is active
      if (AppState.currentState === 'active') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Network request failed') && 
            !errorMessage.includes('Request cancelled') &&
            !errorMessage.includes('app in background')) {
          console.error('❌ Error fetching company ads:', error);
        }
      }
      setCompanyAds([]);
    }
  };

  // Import the service dynamically to avoid circular dependencies
  const fetchAds = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsDeviceOffline(false);
      
      // ✅ FIX: Don't fetch ads if app is in background - wait for foreground
      if (appStateRef.current !== 'active') {
        console.log('📱 [AdFetch] App not in foreground - loading cached ads instead');
        const hasCached = await loadCachedAds();
        setLoading(false);
        return;
      }
      
      // Check network status first
      const isConnected = await checkNetworkStatus();
      if (!isConnected) {
        log.adPlayback('Network is offline, loading cached ads');
        const hasCached = await loadCachedAds();
        if (hasCached) {
          setIsDeviceOffline(true);
          // Cached ads loaded
          setLoading(false);
          return;
        } else {
          setError('Device is offline and no cached content is available');
          setLoading(false);
          return;
        }
      }
      
      // ✅ FIX: Use statically imported tabletRegistrationService (no dynamic import needed)
      const result = await tabletRegistrationService.fetchAds(materialId, slotNumber);
      
      if (result.success && result.ads.length > 0) {
        // ✅ DEBUG: Log received ads before filtering
        const userAdsCount = result.ads.filter((ad: any) => !ad.isCompanyAd).length;
        const companyAdsCount = result.ads.filter((ad: any) => ad.isCompanyAd).length;
        console.log(`📦 [Ad Fetch] Received ${result.ads.length} ads from server: ${userAdsCount} user ads, ${companyAdsCount} company ads`);
        
        // Filter out invalid ads before setting state
        const validAds = await filterValidAds(result.ads);
        
        // ✅ DEBUG: Log valid ads after filtering
        const validUserAdsCount = validAds.filter((ad: any) => !ad.isCompanyAd).length;
        const validCompanyAdsCount = validAds.filter((ad: any) => ad.isCompanyAd).length;
        console.log(`✅ [Ad Fetch] Valid ads after filtering: ${validAds.length} total (${validUserAdsCount} user, ${validCompanyAdsCount} company)`);
        
        if (validAds.length > 0) {
          setAds(validAds);
          setCurrentAdIndex(0);
          // New ads loaded
          console.log(`🎬 [Ad Fetch] Loaded ${validAds.length} valid ads (${validUserAdsCount} user, ${validCompanyAdsCount} company)`);
          
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
        const errorMessage = 'Unable to fetch ads and no cached content available';
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
    const unsubscribe = NetInfo.addEventListener(async (state: any) => {
      // Use server accessibility check instead of just NetInfo
      // Use statically imported tabletRegistrationService (no dynamic import needed)
      const serverAccessible = await tabletRegistrationService.checkServerAccessibility();
      
      // If server check was skipped (app in background), use NetInfo result
      const isConnected = serverAccessible === 'skipped' 
        ? (state.isConnected && state.isInternetReachable)
        : (serverAccessible || (state.isConnected && state.isInternetReachable));
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
    
    // Master-Slave Logic: Both slots fetch ads (to have same library)
    // But Slot 2 waits for display data from Slot 1 to know which ad to show
    console.log(`${slotNumber === 1 ? '👑' : '👥'} [AdPlayer] Slot ${slotNumber} - Fetching ads...`);
    
    // Fetch both user ads and company ads
    const fetchAllAds = async () => {
      await Promise.all([
        fetchAds(),
        fetchCompanyAds()
      ]);
      
      // After fetching, Slot 2 enters mirror mode
      if (slotNumber === 2) {
        console.log('👥 [AdPlayer] Slot 2 - Ads fetched, now waiting for master display data...');
        setWaitingForMaster(true);
        // Don't start playing yet - wait for display data from Slot 1
      }
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

  // ✅ Track if initial ads fetch has been completed to prevent repeated fetching
  const hasFetchedInitialAds = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const wasPlayingBeforeBackground = useRef(false);
  const currentVideoPositionBeforeBackground = useRef<number>(0);
  const isResumingFromBackground = useRef(false); // Track if we're currently resuming from background
  
  // ✅ FIX: Handle app state changes to preserve and resume playback
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousState === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
        // App is going to background
        console.log('📱 [AdPlayer] App going to background - preserving playback state');
        
        // Save current playback state
        wasPlayingBeforeBackground.current = isPlaying && !isPaused;
        
        // Save current video position if available
        if (videoRef.current && wasPlayingBeforeBackground.current) {
          try {
            const status = await videoRef.current.getStatusAsync();
            if (status.isLoaded && status.positionMillis) {
              currentVideoPositionBeforeBackground.current = status.positionMillis / 1000; // Convert to seconds
              console.log(`📱 [AdPlayer] Saved video position: ${currentVideoPositionBeforeBackground.current.toFixed(2)}s`);
            }
          } catch (error) {
            console.log('📱 [AdPlayer] Could not get video position:', error);
          }
        }
        
        // Pause video playback (optional - you can comment this out if you want background playback)
        // Note: Some platforms may pause automatically when app goes to background
        if (videoRef.current && isPlaying && !isPaused) {
          try {
            await videoRef.current.pauseAsync();
            setIsPaused(true);
            console.log('📱 [AdPlayer] Video paused due to background');
          } catch (error) {
            console.log('📱 [AdPlayer] Error pausing video:', error);
          }
        }
      } else if ((previousState === 'background' || previousState === 'inactive') && nextAppState === 'active') {
        // App is coming back to foreground
        console.log('📱 [AdPlayer] App coming to foreground - auto-resuming playback');
        
        // Mark that we're resuming from background to prevent conflicts with other useEffects
        // This also prevents URL validation during resume to avoid cancelled request errors
        isResumingFromBackground.current = true;
        
        // ✅ FIX: Wait a bit for app state to fully stabilize and request manager to recognize app is active
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // ✅ FIX: Don't refetch ads if we already have them - just resume playback
        if (ads.length > 0 || companyAds.length > 0) {
          console.log('📱 [AdPlayer] Ads already loaded - auto-resuming playback without refetching');
          
          // Wait a bit longer to ensure video ref is fully ready and component is mounted
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // ✅ FIX: Always try to resume if we have ads, not just if it was playing before
          // Check if we have a current ad to play
          const hasCurrentAd = (currentAdIndex >= 0 && currentAdIndex < ads.length) || 
                              (currentAdIndex === -1 && companyAds.length > 0);
          
          if (hasCurrentAd && videoRef.current) {
            try {
              // Get current video status to check if it's loaded
              const status = await videoRef.current.getStatusAsync();
              
              if (status.isLoaded) {
                // Restore video position if we saved it
                if (currentVideoPositionBeforeBackground.current > 0 && wasPlayingBeforeBackground.current) {
                  await videoRef.current.setPositionAsync(currentVideoPositionBeforeBackground.current * 1000);
                  console.log(`📱 [AdPlayer] Restored video position: ${currentVideoPositionBeforeBackground.current.toFixed(2)}s`);
                }
                
                // ✅ AUTO-RESUME: Always resume playback when app comes to foreground
                await videoRef.current.playAsync();
                setIsPaused(false);
                setIsPlaying(true);
                console.log('📱 [AdPlayer] ✅ Video auto-resumed from background');
              } else {
                // Video not loaded yet - wait a bit more and try again
                console.log('📱 [AdPlayer] Video not loaded yet, waiting...');
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Try again
                const retryStatus = await videoRef.current.getStatusAsync();
                if (retryStatus.isLoaded) {
                  await videoRef.current.playAsync();
                  setIsPaused(false);
                  setIsPlaying(true);
                  console.log('📱 [AdPlayer] ✅ Video auto-resumed from background (retry)');
                } else {
                  console.log('📱 [AdPlayer] ⚠️ Video still not loaded, setting shouldPlay to true');
                  // If video isn't loaded yet, at least set paused to false so it plays when ready
                  setIsPaused(false);
                }
              }
            } catch (error) {
              console.log('📱 [AdPlayer] Error auto-resuming video:', error);
              // If resume fails, try to play from current position
              try {
                await videoRef.current.playAsync();
                setIsPaused(false);
                setIsPlaying(true);
                console.log('📱 [AdPlayer] ✅ Video auto-resumed from background (fallback)');
              } catch (resumeError) {
                console.log('📱 [AdPlayer] ⚠️ Error on auto-resume retry, setting shouldPlay to true:', resumeError);
                // Last resort: just set paused to false so video plays when ready
                setIsPaused(false);
              }
            }
          } else if (!hasCurrentAd) {
            console.log('📱 [AdPlayer] No current ad to resume, but ads are loaded');
          } else if (!videoRef.current) {
            console.log('📱 [AdPlayer] Video ref not ready yet, setting paused to false');
            // Video ref not ready, but set paused to false so it plays when ready
            setIsPaused(false);
          }
        } else {
          // No ads loaded - fetch them now
          console.log('📱 [AdPlayer] No ads loaded - fetching ads after coming to foreground');
          if (isRegistered === true && !loading && !isDeviceOffline) {
            fetchAds();
            fetchCompanyAds();
          }
        }
        
        // Clear the flag after a delay to allow the state to settle and requests to complete
        // This prevents URL validation from triggering during the resume process
        setTimeout(() => {
          isResumingFromBackground.current = false;
          console.log('📱 [AdPlayer] Background resume flag cleared - validation can proceed normally');
        }, 2000); // Increased to 2 seconds to ensure app state is fully stable
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying, isPaused, ads.length, companyAds.length, currentAdIndex, isRegistered, loading, isDeviceOffline, fetchAds, fetchCompanyAds]);
  
  // ✅ FIX: Ensure video plays when isPaused becomes false (e.g., after returning from background)
  // This is a backup mechanism - the AppState listener handles the main resume logic
  useEffect(() => {
    // Skip if we're already handling resume from AppState listener
    if (isResumingFromBackground.current) {
      return;
    }
    
    // When paused state changes to false and we have a video ref, ensure it plays
    if (!isPaused && videoRef.current && (ads.length > 0 || companyAds.length > 0)) {
      const ensurePlayback = async () => {
        try {
          const status = await videoRef.current?.getStatusAsync();
          if (status && status.isLoaded && !status.isPlaying) {
            // Video is loaded but not playing - start it
            console.log('📱 [AdPlayer] Ensuring video playback - starting video');
            await videoRef.current?.playAsync();
            setIsPlaying(true);
          }
        } catch (error) {
          console.log('📱 [AdPlayer] Error ensuring playback:', error);
        }
      };
      
      // Small delay to ensure video ref is ready
      const timeoutId = setTimeout(ensurePlayback, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [isPaused, ads.length, companyAds.length]);
  
  // ✅ Initial ad fetch on mount (ads start/end at 8 AM via cron, no need for 5-min polling)
  useEffect(() => {
    // Only fetch if:
    // 1. Device is registered
    // 2. Not currently loading
    // 3. Device is online (not in offline mode)
    // 4. Haven't already fetched initial ads (or materialId changed)
    // 5. App is in foreground (don't fetch if app is in background)
    if (isRegistered === false || isRegistered === null) {
      return; // Don't fetch if not registered
    }

    if (loading) {
      return; // Don't fetch while already loading
    }

    if (isDeviceOffline) {
      return; // Don't fetch if device is offline
    }

    // ✅ FIX: Don't fetch if app is in background
    if (appStateRef.current !== 'active') {
      console.log('📱 [AdPlayer] App not in foreground - skipping ad fetch');
      return;
    }

    // ✅ Prevent repeated fetching - only fetch if:
    // - We haven't fetched initial ads yet, OR
    // - Material ID changed (different device), OR
    // - We have no ads at all
    const shouldFetch = !hasFetchedInitialAds.current || 
                       (hasFetchedInitialAds.current && ads.length === 0 && companyAds.length === 0);
    
    if (!shouldFetch) {
      return; // Already fetched and have ads, don't fetch again
    }

    console.log('🔄 [AdPlayer] Fetching ads on mount...');
    
    // Fetch ads once on mount
    // Ads are scheduled via cron job which runs hourly, so no need for periodic polling
    // Ads can only start at 8:00 AM Manila time when ad player opens
    if (!loading && !isDeviceOffline && isRegistered === true) {
      hasFetchedInitialAds.current = true;
      fetchAds();
      fetchCompanyAds();
    }
  }, [isRegistered, loading, isDeviceOffline, materialId, slotNumber]);
  
  // Reset fetch flag when materialId changes (different device)
  useEffect(() => {
    hasFetchedInitialAds.current = false;
  }, [materialId]);

  // Failover Detection for Slot 2: Monitor master connection
  useEffect(() => {
    // Only for Slot 2
    if (slotNumber !== 2 || !isRegistered) {
      return;
    }

    const MASTER_TIMEOUT = 10000; // 10 seconds without updates = master offline
    
    const checkMasterConnection = setInterval(() => {
      if (lastMasterUpdate) {
        const timeSinceLastUpdate = Date.now() - lastMasterUpdate.getTime();
        
        if (timeSinceLastUpdate > MASTER_TIMEOUT && masterConnected) {
          // Master has been offline for too long - trigger failover
          console.log('🚨 [AdPlayer] Slot 2 FAILOVER TRIGGERED - No updates from master for 10+ seconds');
          console.log('⚡ [AdPlayer] Slot 2 promoting to MASTER mode - fetching ads...');
          
          setMasterConnected(false);
          setWaitingForMaster(false);
          setIsMaster(true);
          
          // ✅ CRITICAL: Resume playback when entering failover mode
          // Slot 2 should continue playing as master, not stay paused
          setIsPaused(false);
          
          // ✅ NEW: Enable broadcasting for Slot 2 in failover mode
          playbackWebSocketService.setSlaveMode(false);
          
          // Fetch ads now that we're in failover mode
          const fetchAllAds = async () => {
            await Promise.all([
              fetchAds(),
              fetchCompanyAds()
            ]);
          };
          fetchAllAds();
        }
      } else if (waitingForMaster) {
        // Still waiting for first update from master after 30 seconds - assume master is offline
        const timeSinceMount = Date.now() - new Date().getTime();
        if (timeSinceMount > 30000) {
          console.log('🚨 [AdPlayer] Slot 2 FAILOVER - Never received data from master after 30s');
          console.log('⚡ [AdPlayer] Slot 2 promoting to MASTER mode - fetching ads...');
          
          setMasterConnected(false);
          setWaitingForMaster(false);
          setIsMaster(true);
          
          // ✅ CRITICAL: Resume playback when entering failover mode
          // Slot 2 should continue playing as master, not stay paused
          setIsPaused(false);
          
          // ✅ NEW: Enable broadcasting for Slot 2 in failover mode
          playbackWebSocketService.setSlaveMode(false);
          
          // Fetch ads now that we're in failover mode
          const fetchAllAds = async () => {
            await Promise.all([
              fetchAds(),
              fetchCompanyAds()
            ]);
          };
          fetchAllAds();
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(checkMasterConnection);
  }, [slotNumber, lastMasterUpdate, masterConnected, waitingForMaster, isRegistered]);

  // Monitor master reconnection (fallback to slave mode when master comes back online)
  useEffect(() => {
    // Only for Slot 2 that's in failover mode
    if (slotNumber !== 2 || !isMaster || masterConnected) {
      return;
    }

    // If we start receiving display data again, revert to slave mode
    if (lastMasterUpdate) {
      const timeSinceLastUpdate = Date.now() - lastMasterUpdate.getTime();
      
      if (timeSinceLastUpdate < 5000) { // Master is back online
        console.log('✅ [AdPlayer] Slot 1 (Master) is back online - Slot 2 returning to SLAVE mode');
        console.log('👥 [AdPlayer] Slot 2 resuming mirror mode');
        
        setIsMaster(false);
        setMasterConnected(true);
        setWaitingForMaster(false);
        
        // ✅ NEW: Disable broadcasting for Slot 2 when returning to slave mode
        playbackWebSocketService.setSlaveMode(true);
      }
    }
  }, [slotNumber, lastMasterUpdate, isMaster, masterConnected]);

  // Company ad data (Ads2Go branding)
  // Track ad playback when current ad changes
  useEffect(() => {
    if (currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad') {
      // ❌ REMOVED: trackAdPlayback() - only track when video actually plays (in onPlaybackStatusUpdate)
      // This prevents duplicate tracking
      
      // Reset states for new ad
      setVideoActuallyStarted(false);
      setAdStartTime(null); // Reset ad start time - will be set when video actually plays
      
      // Reset retry count for new ad
      setRetryCount(0);
      
      // Log ad loading occasionally to reduce noise
      if (Math.random() < 0.3) { // Log ~30% of ad loading
        log.adPlayback('New ad loaded', { adTitle: currentAd.adTitle });
      }
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

  // Debug logging - only log occasionally to reduce noise
  if (Math.random() < 0.05) { // Log ~5% of renders
    log.adPlayback('Ad state', {
      adTitle: currentAd?.adTitle || 'No ad',
      duration: currentAd?.duration || 0
    });
  }

  const handleVideoEnd = async () => {
    // 🛡️ GUARD: Prevent multiple concurrent calls
    if (isHandlingVideoEnd.current) {
      console.log('⚠️ handleVideoEnd already in progress, skipping duplicate call');
      return;
    }
    
    isHandlingVideoEnd.current = true;
    
    try {
      // ✅ FIX: Capture current state values at the start to avoid stale closures
      const currentIndex = currentAdIndex;
      const currentRepeat = companyAdRepeatIndex;
      const currentAdsList = ads;
      const currentCompanyAdsList = companyAds;
      
      console.log(`🎬 handleVideoEnd called - currentAdIndex: ${currentIndex}, total ads: ${currentAdsList.length}`);
      
      // End tracking for current ad
      await endAdPlayback();
      
      // Stop WebSocket updates completely
      playbackWebSocketService.stopPlaybackUpdates();
      
      // Set transitioning state to prevent false progress
      setIsTransitioning(true);
      
      // Reset ad start time for next ad
      setAdStartTime(null);
      
      // Reset video started flag for next ad
      setVideoActuallyStarted(false);
      
      // Helper function to move to next ad and clear guard
      const moveToNextAd = (nextIndex: number, nextRepeat: number = 0) => {
        setTimeout(() => {
          setCurrentAdIndex(nextIndex);
          setCompanyAdRepeatIndex(nextRepeat);
          setIsTransitioning(false);
          isHandlingVideoEnd.current = false;
          console.log(`➡️ Moving to ad index: ${nextIndex}, repeat: ${nextRepeat}`);
        }, 100);
      };
      
      // ✅ NEW: If in company ads only mode (after 8 hours), only show company ads
      if (isCompanyAdsOnlyMode) {
        console.log('🏢 [Company Ads Only Mode] Only showing company ads');
        if (currentCompanyAdsList.length > 0) {
          // Cycle through company ads
          const selectedCompanyAd = selectWeightedCompanyAd(currentCompanyAdsList);
          if (selectedCompanyAd) {
            moveToNextAd(-1, 0);
            console.log(`🏢 [Company Ads Only Mode] Next company ad: ${selectedCompanyAd.title}`);
          } else {
            console.log('⚠️ [Company Ads Only Mode] No company ads available');
            setTimeout(() => {
              setIsTransitioning(false);
              isHandlingVideoEnd.current = false;
            }, 100);
          }
        } else {
          console.log('⚠️ [Company Ads Only Mode] No company ads available');
          setTimeout(() => {
            setIsTransitioning(false);
            isHandlingVideoEnd.current = false;
          }, 100);
        }
        return;
      }
      
      // If no user ads available, loop the company ad
      if (currentAdsList.length === 0) {
        console.log('🔄 No user ads available, looping company ad');
        if (currentCompanyAdsList.length > 0) {
          moveToNextAd(-1, currentRepeat);
        } else {
          console.log('⚠️ No company ads available either');
          setTimeout(() => {
            setIsTransitioning(false);
            isHandlingVideoEnd.current = false;
          }, 100);
        }
        return;
      }
      
      // Calculate how many total slots we need (min 5)
      const TARGET_SLOTS = 5;
      
      // ✅ DEBUG: Log current ad state
      const userAdsInRotation = currentAdsList.filter((ad: any) => !ad.isCompanyAd).length;
      const companyAdsInRotation = currentAdsList.filter((ad: any) => ad.isCompanyAd).length;
      console.log(`🔄 [Video End] Current rotation: ${currentAdsList.length} total ads (${userAdsInRotation} user, ${companyAdsInRotation} company), TARGET: ${TARGET_SLOTS} slots`);
      
      // ✅ FIX: If slots are not full (less than 5 ads), fill with company ads
      if (currentAdsList.length < TARGET_SLOTS && currentCompanyAdsList.length > 0) {
        const companyAdsNeeded = TARGET_SLOTS - currentAdsList.length;
        
        console.log(`🏢 [Company Ad Filling] ${currentAdsList.length} ads in rotation (${userAdsInRotation} user, ${companyAdsInRotation} company) + ${companyAdsNeeded} company ad repeats = ${TARGET_SLOTS} total slots`);
        
        // If currently showing a user ad
        if (currentIndex >= 0) {
          // Move to next user ad
          if (currentIndex < currentAdsList.length - 1) {
            moveToNextAd(currentIndex + 1, 0);
            console.log(`➡️ Next user ad: ${currentIndex + 1}/${currentAdsList.length}`);
          } else {
            // Finished user ads, start company ad rotation (first repeat)
            moveToNextAd(-1, 0);
            console.log(`➡️ User ads complete, showing company ad repeat 1/${companyAdsNeeded}`);
          }
        } else {
          // Currently showing company ad - check if we need more repeats
          const nextRepeat = currentRepeat + 1;
          
          if (nextRepeat < companyAdsNeeded) {
            // Play company ad again
            moveToNextAd(-1, nextRepeat);
            console.log(`➡️ Company ad repeat ${nextRepeat + 1}/${companyAdsNeeded}`);
          } else {
            // Finished all company ad repeats, go back to first user ad
            moveToNextAd(0, 0);
            console.log(`🔄 Company ad rotation complete (played ${companyAdsNeeded}x), looping back to first user ad`);
          }
        }
      } else if (currentAdsList.length >= TARGET_SLOTS) {
        // ✅ FIX: All 5 slots are full: cycle through ALL user ads one by one
        // Use captured currentIndex to ensure we get the correct next index
        const nextIndex = currentIndex < currentAdsList.length - 1 ? currentIndex + 1 : 0;
        moveToNextAd(nextIndex, 0);
        if (nextIndex === 0) {
          console.log(`🔄 Looping back to first ad (completed all ${currentAdsList.length} ads)`);
        } else {
          console.log(`➡️ Next ad: ${nextIndex + 1}/${currentAdsList.length}`);
        }
      } else {
        // No company ads available to fill, just loop user ads
        const nextIndex = currentIndex < currentAdsList.length - 1 ? currentIndex + 1 : 0;
        moveToNextAd(nextIndex, 0);
        if (nextIndex === 0) {
          console.log(`🔄 Looping back to first ad (no company ads available for filling)`);
        } else {
          console.log(`➡️ Next ad: ${nextIndex + 1}/${currentAdsList.length} (no company ads to fill)`);
        }
      }
    } catch (error) {
      console.error('❌ Error in handleVideoEnd:', error);
      // Clear guard on error
      isHandlingVideoEnd.current = false;
      setIsTransitioning(false);
    }
  };

  const handleVideoError = (error: any) => {
    console.error('Video playback error:', error);
    
    // Try to get more specific error information
    let errorMessage = 'Unable to play video';
    if (error && error.error && error.error.message) {
      errorMessage = `Video playback issue: ${error.error.message}`;
    } else if (error && error.message) {
      errorMessage = `Video playback issue: ${error.message}`;
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

  // Show informational message if device is not registered (not an error)
  if (isRegistered === false) {
    return (
      <View style={styles.container}>
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle" size={48} color="#3498db" />
          <Text style={styles.infoTitle}>No Registered Device</Text>
          <Text style={styles.infoText}>
            This tablet needs to be registered before it can display advertisements.
          </Text>
          <Text style={styles.infoSubtext}>
            Please use the registration screen to connect this device.
          </Text>
        </View>
      </View>
    );
  }

  // If we have an error but no current ad, try to show company ad as fallback
  if (error && !currentAd && ads.length === 0 && companyAds.length > 0) {
    console.log('Error with no ads, attempting to show company ad as fallback');
    // Force show company ad using weighted selection
    const fallbackCompanyAd = selectWeightedCompanyAd(companyAds);
    const fallbackAd = fallbackCompanyAd ? {
      adId: fallbackCompanyAd.id,
      adTitle: fallbackCompanyAd.title,
      mediaFile: fallbackCompanyAd.mediaFile,
      duration: fallbackCompanyAd.duration
    } : {
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
            shouldPlay={!isPaused}
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
        
        {/* Error indicator - show only if there's a real error, not just normal offline */}
        {error && error !== 'No ads available' && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="information-circle" size={16} color="#f39c12" />
            <Text style={styles.offlineText}>Using fallback content - {error.replace(/^Error: /i, '')}</Text>
          </View>
        )}
      </View>
    );
  }

  // ✅ FIX: Slot 2 in slave mode should not show error if waiting for master or receiving display data
  // Only show error if Slot 2 is in failover mode (isMaster = true) or if it's Slot 1
  const shouldShowError = (error || !currentAd || ads.length === 0) && 
                          (slotNumber === 1 || (slotNumber === 2 && isMaster) || 
                           (slotNumber === 2 && !masterConnected && !waitingForMaster));
  
  if (shouldShowError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#e74c3c" />
          <Text style={styles.errorTitle}>No Ads Available</Text>
          <Text style={styles.errorText}>
            {error && !error.includes('No ads') ? error.replace(/^Error: /i, '') : 'No advertisements are currently scheduled for this slot.'}
          </Text>
          <Text style={styles.errorSubtext}>
            This could be due to:
          </Text>
          <Text style={styles.errorSubtext}>
            • No ads scheduled for this time slot
          </Text>
          <Text style={styles.errorSubtext}>
            • Device is currently offline (this is normal)
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
      
      {/* Slot 2 Mirror Mode Indicator */}
      {slotNumber === 2 && waitingForMaster && (
        <View style={[styles.offlineIndicator, { backgroundColor: '#3498db' }]}>
          <Ionicons name="sync" size={16} color="white" />
          <Text style={styles.offlineText}>Slot 2 Mirror Mode - Waiting for Master...</Text>
        </View>
      )}
      
      {/* Slot 2 Failover Indicator */}
      {slotNumber === 2 && !masterConnected && !waitingForMaster && (
        <View style={[styles.offlineIndicator, { backgroundColor: '#e74c3c' }]}>
          <Ionicons name="warning" size={16} color="white" />
          <Text style={styles.offlineText}>Slot 2 FAILOVER Mode - Master Offline</Text>
        </View>
      )}
      
      <View 
        style={[styles.videoContainer, isLocked && styles.fullscreenVideoContainer]}
        pointerEvents={isLocked ? 'none' : 'auto'}
      >
        <TouchableOpacity 
          onPress={isLocked ? undefined : handleScreenTap}
          activeOpacity={isLocked ? 1 : 1}
          disabled={isLocked}
          style={{ flex: 1 }}
        >
        {/* 🔍 DEBUG: Log when Video component is about to render */}
        {(() => {
          console.log(`🎬 [Video Render] Rendering Video component:`, {
            hasCurrentAd: !!currentAd,
            adTitle: currentAd?.adTitle,
            mediaFile: currentAd?.mediaFile,
            isPaused,
            shouldPlay: !isPaused,
            videoKey: `${currentAd?.adId || 'no-ad'}-${currentAdIndex === -1 ? `company-${companyAdRepeatIndex}` : currentAdIndex}-${retryCount}`
          });
          return null;
        })()}
        <Video
          key={`${currentAd?.adId || 'no-ad'}-${currentAdIndex === -1 ? `company-${companyAdRepeatIndex}` : currentAdIndex}-${retryCount}`} // Force re-render when switching ads, company ad repeats, or retrying
          ref={videoRef}
          source={{ uri: currentAd?.mediaFile || '' }}
          style={isLocked ? styles.fullscreenVideo : styles.video}
          useNativeControls={false}
          resizeMode={isLocked ? ResizeMode.CONTAIN : ResizeMode.COVER}
          shouldPlay={!isPaused && (slotNumber === 1 || (slotNumber === 2 && (isMaster || (masterConnected && !waitingForMaster && hasReceivedInitialSync))))}
          isLooping={false}
          progressUpdateIntervalMillis={100} // ⚡ Update every 100ms for smooth master/slave sync
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying || false);
              
              // 🔍 DEBUG: Log video playback status to help diagnose playback issues
              if (Math.random() < 0.1) { // Log ~10% of status updates to reduce noise
                console.log(`🎬 [Video Status] isPlaying: ${status.isPlaying}, isPaused: ${isPaused}, position: ${status.positionMillis}ms, duration: ${status.durationMillis}ms, shouldPlay: ${!isPaused}`);
              }
              
              // Track current video position for drift detection (both master and slave)
              // ✅ CRITICAL FIX: For Slot 2, don't update position if we just synced recently
              // This prevents the position from being reset to 0 after a successful sync
              if (status.positionMillis !== undefined) {
                const newPosition = status.positionMillis / 1000;
                const timeSinceLastSync = Date.now() - lastSyncCommandTime.current;
                const timeSinceSuccessfulSeek = Date.now() - lastSuccessfulSeekTime.current;
                
                // ✅ IMPROVED: Only ignore position updates if we recently had a successful seek
                // If seeks are failing, we need to accept the actual position
                let shouldUpdatePosition = true;
                if (slotNumber === 2 && !isMaster && timeSinceLastSync < 300 && timeSinceSuccessfulSeek < 1500) {
                  const lastSyncPos = lastSyncPosition || 0;
                  // Only ignore if position is near 0 AND we successfully synced to > 2s AND video is not playing
                  // If video is playing, we should accept the position even if it's not what we expected
                  if (newPosition < 0.5 && lastSyncPos > 2.0 && !status.isPlaying) {
                    // Position is near 0 but we just successfully synced to a higher position - ignore this update
                    console.log(`⏸️ [Position Tracking] Ignoring position update: ${newPosition.toFixed(1)}s (just synced to ${lastSyncPos.toFixed(1)}s ${timeSinceLastSync}ms ago, not playing)`);
                    shouldUpdatePosition = false; // Skip this position update
                  }
                }
                
                // ✅ CRITICAL: If we've had many seek failures, always accept the actual position
                // This prevents getting stuck when seeking doesn't work
                if (seekFailureCount.current >= MAX_SEEK_FAILURES) {
                  shouldUpdatePosition = true; // Force update to accept reality
                }
                
                // ✅ CRITICAL: If video is actually playing and position is advancing, always accept it
                // This prevents blocking position updates when video is working naturally
                if (status.isPlaying && newPosition > 0.1) {
                  shouldUpdatePosition = true; // Video is playing - accept the position
                }
                
                if (shouldUpdatePosition) {
                  setCurrentVideoPosition(newPosition);
                }
              }
              
              // If this is the master device, broadcast display data to other slots for duplication
              if (isMaster) {
                // ✅ FIX: Detect ad changes to force immediate display data broadcast
                // This ensures Slot 2 gets the new ad info immediately without waiting for throttle
                const adChanged = lastBroadcastAdIndex.current !== currentAdIndex;
                
                // ✅ FIX: Throttle display data to prevent flooding Slot 2 with rapid updates
                // This prevents Slot 2 from constantly seeking/playing, which causes pause/play loops
                // BUT: Always send immediately on ad changes to prevent Slot 2 from getting stuck
                const now = Date.now();
                const timeSinceLastBroadcast = now - lastDisplayDataTime.current;
                const shouldSendDisplayData = adChanged || timeSinceLastBroadcast >= DISPLAY_DATA_THROTTLE;
                
                if (shouldSendDisplayData) {
                  lastDisplayDataTime.current = now;
                  lastBroadcastAdIndex.current = currentAdIndex; // Update last broadcast ad index
                  
                  const displayData = {
                    currentTime: status.positionMillis / 1000, // Convert to seconds
                    isPaused: !status.isPlaying,
                    isBuffering: status.isBuffering || false, // ✅ NEW: Include buffering state
                    adIndex: currentAdIndex,
                    timestamp: new Date().toISOString(),
                    // ✨ NEW: Include ad details for admin monitoring
                    adDetails: currentAd ? {
                      adId: currentAd.adId,
                      adTitle: currentAd.adTitle,
                      adDuration: status.durationMillis ? status.durationMillis / 1000 : (currentAd.duration || 0),
                      isCompanyAd: false // This info is not in currentAd type, default to false
                    } : null
                  };
                  
                  playbackWebSocketService.sendDisplayData(displayData);
                  
                  if (adChanged) {
                    console.log(`📺 [Master] Ad changed to index ${currentAdIndex} - sending display data immediately (bypassing throttle)`);
                  }
                }
              } else {
                // 🔍 DEBUG: Log why we're not sending display data (only log occasionally to reduce noise)
                if (Math.random() < 0.05) { // Log ~5% of the time
                  console.log(`⏭️ [Display Data] Not sending - isMaster: ${isMaster}, slotNumber: ${slotNumber}`);
                }
              }
              
              // ✨ Send adPlaybackUpdate to admin clients for monitoring (throttled to every 2 seconds)
              if (currentAd && status.isLoaded) {
                const now = Date.now();
                const shouldSendUpdate = status.isPlaying && (now - lastPlaybackUpdateTime.current >= 2000);
                
                if (shouldSendUpdate) {
                  const progress = status.durationMillis ? (status.positionMillis / status.durationMillis) * 100 : 0;
                  // Update playback data and force send (state change triggers immediate send)
                  playbackWebSocketService.updatePlaybackDataAndSend({
                    adId: currentAd.adId || '',
                    adTitle: currentAd.adTitle || '',
                    state: 'playing', // Force state to trigger immediate send
                    currentTime: status.positionMillis / 1000, // Convert to seconds
                    duration: status.durationMillis ? status.durationMillis / 1000 : 0,
                    progress: progress
                  });
                  lastPlaybackUpdateTime.current = now;
                }
              }
              
              // ✅ NEW: For Slot 2 (slave), detect buffering state changes and re-sync after buffering
              // ✅ FIX: Only request sync if we're significantly behind (drift > 2 seconds)
              // This prevents unnecessary sync requests that cause restarts
              if (slotNumber === 2 && !isMaster) {
                const isCurrentlyBuffering = status.isBuffering || false;
                
                // Detect when buffering completes
                if (wasBuffering && !isCurrentlyBuffering) {
                  // Check if we're significantly behind before requesting sync
                  const currentPos = status.positionMillis ? status.positionMillis / 1000 : 0;
                  const lastSyncPos = lastSyncPosition || 0;
                  const drift = Math.abs(currentPos - lastSyncPos);
                  
                  // ✅ FIX: Don't request re-sync after buffering - this creates an infinite loop
                  // Display data already handles drift correction every 100ms
                  // Buffer recovery re-sync was causing Slot 2 to constantly seek and never play
                  console.log(`📺 [Slave Buffer Recovery] Buffering completed with drift ${drift.toFixed(1)}s - display data will sync`);
                }
                
                setWasBuffering(isCurrentlyBuffering);
              }
              
              // Track ad start time when video starts playing (tracking happens at END with actual view time)
              // Use more reliable conditions: isPlaying AND positionMillis > 0 AND isLoaded
              if (status.isPlaying && status.isLoaded && status.positionMillis > 0 && currentAd && currentAd.adTitle && currentAd.adTitle !== 'No Ad' && !adStartTime && !videoActuallyStarted) {
                console.log(`🎬 Video ACTUALLY playing with position ${status.positionMillis}ms, starting timer for: ${currentAd.adTitle}`);
                
                // Set flag immediately to prevent duplicate calls
                setVideoActuallyStarted(true);
                
                // Add a small delay to ensure video is really playing and not just buffering
                setTimeout(() => {
                  // Double-check that video is still playing after delay
                  if (status.isPlaying && status.positionMillis > 0) {
                    console.log(`🎬 Video confirmed playing after delay, position: ${status.positionMillis}ms`);
                    setAdStartTime(new Date()); // ✅ Start timer - tracking happens at END in endAdPlayback()
                    // ❌ REMOVED: trackAdPlayback() call here - only track at END with actual view time
                    
                    // ❌ REMOVED: Per-second playback updates (not needed for progress bar)
                    // console.log('🎬 [AdPlayer] Video CONFIRMED playing - starting WebSocket updates NOW');
                    
                    // Mark that video has actually started
                    setVideoActuallyStarted(true);
                  } else {
                    console.log('🎬 Video stopped playing during delay, not starting WebSocket updates');
                  }
                }, 500); // 500ms delay to ensure video is really playing
              }
              
              // ❌ REMOVED: Per-second playback updates during playback
              // These are not needed for progress bar functionality
              
              // Clean up any lingering playback update intervals when video is not playing
              if (currentAd && (!status.isLoaded || !status.isPlaying)) {
                playbackWebSocketService.stopPlaybackUpdates();
              }
              
              // ✅ FIX: Use currentAd.duration as fallback when status.durationMillis is not available or incorrect
              // This fixes the issue where Device 002's video player reports incorrect durationMillis (e.g., 3000ms)
              const videoDurationMillis = status.durationMillis || (currentAd?.duration ? currentAd.duration * 1000 : null);
              
              // Validate duration is reasonable (not too small - minimum 5 seconds)
              const MIN_DURATION_MS = 5000; // 5 seconds minimum
              const isValidDuration = videoDurationMillis && videoDurationMillis >= MIN_DURATION_MS;
              
              // Use database duration if video player duration is invalid or missing
              const effectiveDurationMillis = isValidDuration ? videoDurationMillis : (currentAd?.duration ? currentAd.duration * 1000 : null);
              
              // 🔍 DEBUG: Log video position near end
              if (status.positionMillis && effectiveDurationMillis) {
                const progress = (status.positionMillis / effectiveDurationMillis) * 100;
                if (progress > 95) {
                  console.log(`🔍 Video near end: ${progress.toFixed(1)}% (${status.positionMillis}ms / ${effectiveDurationMillis}ms)`);
                }
              }
              
              // Log warning if using fallback duration
              if (status.durationMillis && !isValidDuration && currentAd?.duration) {
                console.warn(`⚠️ [Video Duration] Video player reported invalid duration (${status.durationMillis}ms), using database duration (${currentAd.duration * 1000}ms) for ad: ${currentAd.adTitle}`);
              } else if (!status.durationMillis && currentAd?.duration) {
                console.log(`ℹ️ [Video Duration] Video player duration not available, using database duration (${currentAd.duration * 1000}ms) for ad: ${currentAd.adTitle}`);
              }
              
              // Check for video end - use multiple signals with fallback duration
              const isVideoEnded = status.didJustFinish || 
                                   (status.positionMillis && effectiveDurationMillis && 
                                    status.positionMillis >= effectiveDurationMillis - 100); // Within 100ms of end
              
              if (isVideoEnded) {
                console.log(`🎬 Video ended detected! didJustFinish=${status.didJustFinish}, position=${status.positionMillis}ms, playerDuration=${status.durationMillis || 'N/A'}ms, effectiveDuration=${effectiveDurationMillis || 'N/A'}ms, adDuration=${currentAd?.duration || 'N/A'}s`);
                // Stop WebSocket updates when ad ends
                playbackWebSocketService.stopPlaybackUpdates();
                handleVideoEnd();
              }
            } else if (status.error) {
              // Handle buffering/loading states with detailed error info
              if (currentAd) {
                const errorStatus = status as any;
                sendPlaybackUpdate({
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
            console.log(`🎬 [Video] Loading started for ad: ${currentAd?.adTitle || 'Unknown'}`, {
              mediaFile: currentAd?.mediaFile,
              adId: currentAd?.adId,
              currentAdIndex,
              isPaused,
              shouldPlay: !isPaused
            });
            if (currentAd) {
              sendPlaybackUpdate({
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
            console.log(`🎬 [Video] Loaded successfully: ${currentAd?.adTitle || 'Unknown'}`, {
              mediaFile: currentAd?.mediaFile,
              adId: currentAd?.adId,
              isPaused,
              shouldPlay: !isPaused
            });
            // ✅ FIX: For Slot 2 in slave mode, ensure video plays when loaded if master is playing
            // ✅ FIX: Throttle to prevent rapid play commands
            if (slotNumber === 2 && masterConnected && !isMaster && !isPaused && videoRef.current) {
              const now = Date.now();
              if (now - lastPlayCommandTime.current >= PLAY_COMMAND_THROTTLE) {
                lastPlayCommandTime.current = now;
                console.log(`▶️ [Slave Load] Video loaded - ensuring playback for Slot 2`);
                videoRef.current.playAsync().catch(err => {
                  console.warn(`⚠️ [Slave Load] Error playing on load:`, err);
                });
              }
            }
            
            // Only log video events occasionally to reduce noise
            if (Math.random() < 0.3) { // Log ~30% of video events
              log.adPlayback('Video loaded', { adTitle: currentAd?.adTitle });
            }
            if (currentAd) {
              sendPlaybackUpdate({
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
            console.log(`🎬 [Video] Ready for display: ${currentAd?.adTitle || 'Unknown'}`, {
              mediaFile: currentAd?.mediaFile,
              adId: currentAd?.adId,
              isPaused,
              shouldPlay: !isPaused
            });
            // ✅ FIX: For Slot 2 in slave mode, ensure video plays when ready if master is playing
            // ✅ FIX: Throttle to prevent rapid play commands
            if (slotNumber === 2 && masterConnected && !isMaster && !isPaused && videoRef.current) {
              const now = Date.now();
              if (now - lastPlayCommandTime.current >= PLAY_COMMAND_THROTTLE) {
                lastPlayCommandTime.current = now;
                console.log(`▶️ [Slave Ready] Video ready for display - ensuring playback for Slot 2`);
                videoRef.current.playAsync().catch(err => {
                  console.warn(`⚠️ [Slave Ready] Error playing on ready:`, err);
                });
              }
            }
            
            // Only log video events occasionally to reduce noise
            if (Math.random() < 0.3) { // Log ~30% of video events
              log.adPlayback('Video ready', { adTitle: currentAd?.adTitle });
            }
            if (currentAd) {
              // Only log debug info occasionally
              if (Math.random() < 0.1) { // Log ~10% of debug info
                log.adPlayback('Video ready - waiting for playback');
              }
              
              // Clear transitioning state - video is ready
              setIsTransitioning(false);
              
              // 🔍 DEBUG: Try to manually start playback if video is ready but not playing
              if (!isPaused && videoRef.current) {
                setTimeout(async () => {
                  try {
                    const status = await videoRef.current?.getStatusAsync();
                    if (status && status.isLoaded && !status.isPlaying && !isPaused) {
                      console.log(`🎬 [Video] Video ready but not playing - attempting to start playback`);
                      await videoRef.current?.playAsync();
                    }
                  } catch (err) {
                    console.log(`🎬 [Video] Error checking/starting playback:`, err);
                  }
                }, 500);
              }
            }
          }}
        />
          </TouchableOpacity>
        </View>
        
        {/* Minimal Ad Info Overlay - Always visible */}
        <View style={styles.adInfoOverlay}>
        <Text style={styles.adTitle}>
          {currentAd?.adTitle || 'No Ad'}
          {isPaused && ' ⏸️ PAUSED'}
          {isSyncing && ' 🔄 SYNCING'}
          {isLocked && ' 🔒 LOCKED'}
          {slotNumber === 2 && masterConnected && ' 🪞 MIRROR'}
          {slotNumber === 2 && !masterConnected && !waitingForMaster && ' ⚡ FAILOVER'}
        </Text>
        {/* ✅ FIX: Only show "Paused by Admin" message for Slot 1 or Slot 2 in failover mode */}
        {/* Slot 2 in slave mode should not show this message - it's just mirroring Slot 1 */}
        {isPaused && (slotNumber === 1 || (slotNumber === 2 && isMaster)) && (
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={[styles.adTitle, { color: '#ff6b6b', fontSize: 16, marginBottom: 10 }]}>
              🎬 Video Paused by Admin
            </Text>
            <TouchableOpacity 
              style={{
                backgroundColor: '#4CAF50',
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 5,
              }}
              onPress={resumeAd}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>
                ▶️ Resume Ad
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {isSyncing && (
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={[styles.adTitle, { color: '#2196F3', fontSize: 16, marginBottom: 10 }]}>
              🔄 Syncing with other devices...
            </Text>
            <Text style={[styles.adTitle, { color: '#666', fontSize: 14 }]}>
              Perfect synchronization in progress
            </Text>
            {syncData?.executeAt && (
              <Text style={[styles.adTitle, { color: '#999', fontSize: 12, marginTop: 5 }]}>
                Execute at: {new Date(syncData.executeAt).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}
        </View>

        {/* Ad Counter - Always visible */}
        <View style={styles.adCounter}>
          <Text style={styles.adCounterText}>
            {currentAdIndex === -1 
              ? `${ads.length + companyAdRepeatIndex + 1}/5 (Company)` // Show position in rotation for company ad
              : `${currentAdIndex + 1}/${Math.max(5, ads.length)}`} {/* Show position for user ads */}
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
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  infoTitle: {
    color: '#3498db',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  infoText: {
    color: '#bdc3c7',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  infoSubtext: {
    color: '#95a5a6',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    fontStyle: 'italic',
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
  fullscreenVideoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 1000,
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
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
    zIndex: 2000, // Ensure ad info is always visible above video, even when locked
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
    zIndex: 2000, // Ensure ad counter is always visible above video, even when locked
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
    zIndex: 2000, // Ensure QR code is always visible above video, even when locked
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

