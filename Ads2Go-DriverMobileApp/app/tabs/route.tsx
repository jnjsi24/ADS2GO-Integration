import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator, 
  Alert, 
  Dimensions,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  Animated,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import RouteMapView from '../../components/RouteMapView';
import playbackWebSocketService from '../../services/playbackWebSocketService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  heading: number;
  accuracy: number;
  address: string;
}

interface RouteMetrics {
  totalDistance: number;
  totalDuration: number;
  averageSpeed: number;
  pointCount: number;
  startTime: string | null;
  endTime: string | null;
}

interface RouteData {
  deviceId: string;
  materialId: string;
  route: RoutePoint[];
  metrics: RouteMetrics;
}

interface DriverInfo {
  driverId: string;
  materialId: string;
  deviceId: string;
  materialAssignedDate?: string; // Date when driver was assigned to material
}

const RouteTab: React.FC = () => {
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Date selection for historical data
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);

  // Helper function to check if selected date is today
  const isSelectedDateToday = (): boolean => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0, 0);
    return today.getTime() === selected.getTime();
  };
  
  // Session status state (8-hour requirement)
  const [sessionStatus, setSessionStatus] = useState<{
    isActive: boolean;
    startTime: string | null;
    endTime: string | null;
    currentHours: number;
    targetHours: number;
    remainingHours: number;
    progressPercent: number;
    complianceStatus: 'PENDING' | 'COMPLIANT' | 'NON_COMPLIANT';
  } | null>(null);
  
  // ✅ NEW: Overall compliance rating state
  const [overallCompliance, setOverallCompliance] = useState<{
    complianceRate: number;
    rating: 'VERY GOOD' | 'GOOD' | 'AVERAGE';
    totalDays: number;
    compliantDays: number;
  } | null>(null);
  
  // Ad player online status
  const [isAdPlayerOnline, setIsAdPlayerOnline] = useState(false);
  const [lastSeenTime, setLastSeenTime] = useState<Date | null>(null);
  
  // ✅ NEW: Midnight reset mode - show only last location marker
  const [showOnlyLastLocation, setShowOnlyLastLocation] = useState(false);
  const [lastLocationPoint, setLastLocationPoint] = useState<RoutePoint | null>(null);
  
  // ✅ Store geocoded addresses to avoid re-geocoding
  const [geocodedAddresses, setGeocodedAddresses] = useState<Map<string, string>>(new Map());
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressesReady, setAddressesReady] = useState(false); // Track if addresses are ready for display
  
  // 🔄 NEW: Batch GPS updates to prevent constant WebView reloads (smooth route line display)
  const pendingGPSPointsRef = useRef<RoutePoint[]>([]);
  
  // Bottom Sheet State
  const bottomSheetHeight = screenHeight * 0.85; // 85% of screen height when fully open
  const bottomSheetDefaultHeight = 230; // Default height to show vehicle status and metrics
  const bottomSheetMinHeight = 120; // Minimum height when collapsed
  const bottomSheetY = useRef(new Animated.Value(screenHeight - bottomSheetDefaultHeight)).current;
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(false);
  
  // PanResponder for bottom sheet drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        bottomSheetY.setOffset((bottomSheetY as any)._value);
        (bottomSheetY as any)._value = 0;
      },
      onPanResponderMove: (_, gestureState) => {
        const currentValue = (bottomSheetY as any)._offset + gestureState.dy;
        const minY = screenHeight - bottomSheetHeight;
        const maxY = screenHeight - bottomSheetMinHeight;
        const clampedValue = Math.max(minY, Math.min(maxY, currentValue));
        bottomSheetY.setValue(clampedValue - (bottomSheetY as any)._offset);
      },
      onPanResponderRelease: (_, gestureState) => {
        bottomSheetY.flattenOffset();
        const currentY = (bottomSheetY as any)._value;
        const minY = screenHeight - bottomSheetHeight; // Fully expanded
        const defaultY = screenHeight - bottomSheetDefaultHeight; // Default (shows vehicle status + metrics)
        const maxY = screenHeight - bottomSheetMinHeight; // Fully collapsed
        
        // Determine target position based on current position, gesture direction, and velocity
        const threshold1 = (minY + defaultY) / 2; // Between expanded and default
        const threshold2 = (defaultY + maxY) / 2; // Between default and collapsed
        
        let targetY: number;
        
        if (currentY < threshold1) {
          // Closer to expanded - snap to expanded
          targetY = minY;
          setBottomSheetExpanded(true);
        } else if (currentY < threshold2) {
          // Between expanded and collapsed - snap to default
          targetY = defaultY;
          setBottomSheetExpanded(false);
        } else {
          // Closer to collapsed - snap to collapsed
          targetY = maxY;
          setBottomSheetExpanded(false);
        }
        
        // Override with velocity if strong enough
        if (gestureState.vy < -0.8 && currentY > defaultY) {
          // Strong upward swipe from default/collapsed -> expand
          targetY = minY;
          setBottomSheetExpanded(true);
        } else if (gestureState.vy > 0.8 && currentY < defaultY) {
          // Strong downward swipe from expanded -> default
          targetY = defaultY;
          setBottomSheetExpanded(false);
        } else if (gestureState.vy > 0.8 && currentY >= defaultY) {
          // Strong downward swipe from default -> collapse
          targetY = maxY;
          setBottomSheetExpanded(false);
        }
        
        Animated.spring(bottomSheetY, {
          toValue: targetY,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }).start();
      },
    })
  ).current;
  useEffect(() => {
    // ✅ CRITICAL FIX: Use local date comparison to avoid timezone issues
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();
    
    const isToday = selectedYear === nowYear && selectedMonth === nowMonth && selectedDay === nowDay;
    
    const selectedDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    
    console.log('🔄 [Route Tab] Date changed:', {
      selectedDateStr,
      isToday,
      selectedDate: selectedDate.toString(),
      now: now.toString()
    });
    
    // 🔄 Clear pending GPS queue when date changes
    pendingGPSPointsRef.current = [];
    
    loadDriverInfoAndRoute(false); // Initial load with loading screen
    
    if (isToday) {
      console.log('📅 [Route Tab] Today detected - enabling real-time WebSocket updates');
      setIsRealTimeActive(true);
    } else {
      console.log('📅 [Route Tab] Historical date - real-time updates disabled');
      setIsRealTimeActive(false);
    }
  }, [selectedDate]); // Reload when date changes

  // WebSocket subscription for real-time GPS updates (today's date only)
  useEffect(() => {
    if (!isRealTimeActive || !driverInfo?.deviceId || driverInfo.deviceId === 'No Device') {
      return;
    }

    console.log('🔌 [Route Tab] Setting up WebSocket for real-time GPS tracking');

    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      // Only process updates for our device
      if (update.deviceId !== driverInfo.deviceId) {
        return;
      }

      // ✅ Update ad player online status
      if (update.type === 'adPlaybackUpdate') {
        setIsAdPlayerOnline(true); // Ad player is online if sending updates
        setLastSeenTime(new Date(update.timestamp || new Date()));
      }
      
      // Handle device status updates
      if (update.type === 'deviceUpdate') {
        setIsAdPlayerOnline(update.isOnline || false);
        if (update.lastSeen) {
          setLastSeenTime(new Date(update.lastSeen));
        }
      }
      
      // ✅ Handle session status updates from WebSocket
      if (update.type === 'adPlaybackUpdate' && update.sessionStatus) {
        setSessionStatus({
          isActive: update.sessionStatus.isActive,
          startTime: update.sessionStatus.startTime,
          endTime: update.sessionStatus.endTime || null,
          currentHours: update.sessionStatus.currentHours,
          targetHours: update.sessionStatus.targetHours,
          remainingHours: update.sessionStatus.remainingHours,
          progressPercent: update.sessionStatus.progressPercent,
          complianceStatus: update.sessionStatus.complianceStatus
        });
      }
      
      // Handle GPS data from adPlaybackUpdate messages
      if (update.type === 'adPlaybackUpdate' && update.gpsData) {
        // ✅ NEW: Exit midnight reset mode when device comes online
        if (showOnlyLastLocation) {
          console.log('🌅 [Route Tab] Device came online, exiting midnight reset mode');
          setShowOnlyLastLocation(false);
          setLastLocationPoint(null);
        }
        
        const newPoint: RoutePoint = {
          lat: update.gpsData.lat,
          lng: update.gpsData.lng,
          timestamp: update.gpsData.timestamp,
          speed: update.gpsData.speed * 3.6, // Convert m/s to km/h
          heading: update.gpsData.heading,
          accuracy: update.gpsData.accuracy,
          address: '' // Will be geocoded if needed
        };

        // 🔄 NEW: Add to pending queue instead of immediately updating (prevents constant WebView reloads)
        // The batch update effect will process these every 2 seconds
        pendingGPSPointsRef.current.push(newPoint);
        
        // Log occasionally for debugging
        if (Math.random() < 0.1) {
          console.log('📍 [Route Tab] GPS update queued for batch processing:', {
            speed: `${newPoint.speed.toFixed(1)} km/h`,
            accuracy: `${newPoint.accuracy.toFixed(1)}m`,
            queueSize: pendingGPSPointsRef.current.length
          });
        }
      }
    });

    return () => {
      console.log('🔌 [Route Tab] Cleaning up WebSocket subscription');
      unsubscribe();
    };
  }, [isRealTimeActive, driverInfo?.deviceId]);

  // 🔄 NEW: Batch GPS updates every 2 seconds to prevent constant WebView reloads (smooth display)
  useEffect(() => {
    // Only batch updates when viewing today's date with real-time active
    if (!isRealTimeActive || !driverInfo?.deviceId || driverInfo.deviceId === 'No Device') {
      return;
    }

    console.log('🔄 [Batch Update] Starting 2-second batch update interval for smooth route display');

    const batchInterval = setInterval(() => {
      // Check if there are pending GPS points to process
      if (pendingGPSPointsRef.current.length > 0) {
        const pointsToAdd = [...pendingGPSPointsRef.current]; // Copy the array
        pendingGPSPointsRef.current = []; // Clear the queue

        console.log(`🔄 [Batch Update] Processing ${pointsToAdd.length} GPS points`);

        // Update route data with all pending points at once
        setRouteData(prev => {
          if (!prev) {
            // Initialize route data with first point
            const firstPoint = pointsToAdd[0];
            const newRouteData = {
              deviceId: driverInfo.deviceId,
              materialId: driverInfo.materialId,
              route: pointsToAdd,
              metrics: {
                totalDistance: 0,
                totalDuration: 0,
                averageSpeed: firstPoint.speed,
                pointCount: pointsToAdd.length,
                startTime: firstPoint.timestamp,
                endTime: pointsToAdd[pointsToAdd.length - 1].timestamp
              }
            };
            
            // ✅ Geocode addresses for new route data
            // Use setTimeout to ensure state is updated before geocoding
            setTimeout(() => {
              if (pointsToAdd.length > 0) {
                const segments = segmentRoute(pointsToAdd);
                geocodeSegmentLocations(segments);
              }
            }, 0);
            
            return newRouteData;
          }

          // Add all pending points to existing route
          const updatedRoute = [...prev.route, ...pointsToAdd];
          
          // Update metrics
          const startTime = prev.metrics.startTime || pointsToAdd[0].timestamp;
          const endTime = pointsToAdd[pointsToAdd.length - 1].timestamp;
          const duration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000;
          
          // Calculate total distance including new points
          let totalDistance = prev.metrics.totalDistance || 0;
          let lastPoint = prev.route.length > 0 ? prev.route[prev.route.length - 1] : null;
          
          for (const newPoint of pointsToAdd) {
            if (lastPoint) {
              totalDistance += calculateDistance(
                lastPoint.lat, lastPoint.lng,
                newPoint.lat, newPoint.lng
              );
            }
            lastPoint = newPoint;
          }

          const averageSpeed = duration > 0 ? (totalDistance / duration) * 3600 : 0;

          const updatedRouteData = {
            ...prev,
            route: updatedRoute,
            metrics: {
              totalDistance,
              totalDuration: duration,
              averageSpeed,
              pointCount: updatedRoute.length,
              startTime,
              endTime
            }
          };
          
          // ✅ Geocode addresses for newly added segments
          // Use setTimeout to ensure state is updated before geocoding
          setTimeout(() => {
            if (pointsToAdd.length > 0) {
              const segments = segmentRoute(updatedRoute);
              geocodeSegmentLocations(segments);
            }
          }, 0);
          
          return updatedRouteData;
        });

        setLastUpdate(new Date());
        console.log(`✅ [Batch Update] Route updated with ${pointsToAdd.length} new points`);
      }
    }, 2000); // Process batch every 2 seconds

    return () => {
      console.log('🔄 [Batch Update] Stopping batch update interval');
      clearInterval(batchInterval);
    };
  }, [isRealTimeActive, driverInfo?.deviceId]);

  const loadDriverInfoAndRoute = async (silentRefresh = false) => {
    try {
      // Only show loading screen for initial loads, not for background refreshes
      if (!silentRefresh) {
        setLoading(true);
      }
      setError(null);

      // Load driver info from AsyncStorage
      const driverInfoStr = await AsyncStorage.getItem('driverInfo');
      if (!driverInfoStr) {
        throw new Error('No driver info found');
      }

      const driver = JSON.parse(driverInfoStr);
      const driverId = driver.driverId || driver.id;
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // Fetch driver's material and device info
      const driverResponse = await fetch(`${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!driverResponse.ok) {
        // Handle 404 gracefully - device may have been unregistered
        if (driverResponse.status === 404) {
          console.log('ℹ️ No device tracking found - device may not be registered yet or was unregistered');
        } else {
          console.warn('⚠️ Driver endpoint returned status:', driverResponse.status);
        }
        setDriverInfo({
          driverId,
          materialId: 'Not Assigned',
          deviceId: 'No Device'
        });
        setRouteData(null);
        setLoading(false);
        return;
      }

      let driverData: any;
      try {
        const ct = driverResponse.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          driverData = await driverResponse.json();
        } else {
          const text = await driverResponse.text();
          console.warn('Unexpected content-type for driver info:', ct, text?.slice(0, 200));
          // Show page with no device info
          setDriverInfo({
            driverId,
            materialId: 'Not Assigned',
            deviceId: 'No Device'
          });
          setRouteData(null);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse driver info response:', e);
        // Show page with no device info
        setDriverInfo({
          driverId,
          materialId: 'Not Assigned',
          deviceId: 'No Device'
        });
        setRouteData(null);
        setLoading(false);
        return;
      }
      
      if (!driverData.success) {
        console.warn('Driver data fetch unsuccessful:', driverData.message);
        // Show page with no device info
        setDriverInfo({
          driverId,
          materialId: 'Not Assigned',
          deviceId: 'No Device'
        });
        setRouteData(null);
        setLoading(false);
        return;
      }

      const materialId = driverData.data.materialId || 'Not Assigned';
      const deviceId = driverData.data.deviceId || 'No Device';
      // ✅ Get assigned date - try screenTracking API first, then GraphQL (same as Profile tab)
      let materialAssignedDate = driverData.data.materialAssignedDate;
      
      if (!materialAssignedDate) {
        console.log('⚠️ [Route Tab] No materialAssignedDate in screenTracking API, fetching from GraphQL...');
        try {
          const materialsResponse = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              query: `
                query GetDriverMaterials($driverId: ID!) {
                  getDriverMaterials(driverId: $driverId) {
                    success
                    materials {
                      assignedDate
                    }
                  }
                }
              `,
              variables: { driverId },
            }),
          });
          
          const materialsResult = await materialsResponse.json();
          if (materialsResult.data?.getDriverMaterials?.success) {
            const materials = materialsResult.data.getDriverMaterials.materials;
            if (materials && materials.length > 0 && materials[0].assignedDate) {
              materialAssignedDate = materials[0].assignedDate;
              console.log('✅ [Route Tab] Got assigned date from GraphQL:', materialAssignedDate);
            }
          }
        } catch (error) {
          console.warn('⚠️ [Route Tab] Could not fetch from GraphQL:', error);
        }
      }

      console.log('📅 [Route Tab] Final Material Assigned Date:', materialAssignedDate);

      setDriverInfo({
        driverId,
        materialId,
        deviceId,
        materialAssignedDate: materialAssignedDate || undefined
      });

      // ✅ FIXED: Enhanced route endpoint requires materialId, not deviceId
      // Use materialId as primary identifier for route fetching
      const identifierForRoute = (materialId && materialId !== 'Not Assigned') 
        ? materialId 
        : null;

      console.log('🆔 [Route Tab] Using materialId for route:', identifierForRoute);

      // Only fetch route data if we have a valid materialId
      if (identifierForRoute) {
        await fetchDriverRouteData(identifierForRoute);
      } else {
        console.log('ℹ️ [Route Tab] No valid materialId, skipping route fetch - device not registered');
        // No valid device, but show the page anyway
        setRouteData(null);
      }

      // Update last refresh timestamp
      setLastUpdate(new Date());

    } catch (err) {
      console.log('ℹ️ [Route Tab] Could not load driver info - this is normal if device is not registered');
      // Don't set error state - show the page with limited info
      setDriverInfo({
        driverId: 'Unknown',
        materialId: 'Not Assigned',
        deviceId: 'No Device'
      });
      setRouteData(null);
    } finally {
      // Only hide loading screen if we showed it (not for silent refreshes)
      if (!silentRefresh) {
        setLoading(false);
      }
    }
  };

  const checkMidnightResetMode = async (materialId: string) => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // ✅ CRITICAL FIX: Use local date comparison to avoid timezone issues
      const selectedYear = selectedDate.getFullYear();
      const selectedMonth = selectedDate.getMonth();
      const selectedDay = selectedDate.getDate();
      
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth();
      const nowDay = now.getDate();
      
      const isToday = selectedYear === nowYear && selectedMonth === nowMonth && selectedDay === nowDay;
      
      console.log('🔍 [Midnight Reset] Check started:', {
        selectedDate: `${selectedYear}-${selectedMonth + 1}-${selectedDay}`,
        today: `${nowYear}-${nowMonth + 1}-${nowDay}`,
        isToday,
        currentHour
      });
      
      // Only apply midnight reset if viewing today's date AND between 12 AM - 8 AM
      const isMidnightResetTime = isToday && currentHour >= 0 && currentHour < 8;
      
      if (!isMidnightResetTime) {
        console.log('✅ [Midnight Reset] Not in reset mode - clearing flags:', {
          isToday,
          currentHour,
          reason: !isToday ? 'Historical date' : 'Outside reset hours'
        });
        setShowOnlyLastLocation(false);
        setLastLocationPoint(null);
        return false;
      }
      
      console.log('🌙 [Midnight Reset] In reset mode (12 AM - 8 AM), checking for yesterday\'s last location...');
      
      // ✅ CRITICAL FIX: Get yesterday's date using local time
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayYear = yesterday.getFullYear();
      const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
      const yesterdayDay = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
      
      // Fetch yesterday's route data to get last location
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('No auth token for midnight reset check');
        return false;
      }
      
      // ✅ Use enhanced route endpoint with materialId (required by API)
      const url = `${API_CONFIG.BASE_URL}/api/enhancedRoute/route/${materialId}?date=${yesterdayStr}`;
      console.log('🌐 [Midnight Reset] Fetching yesterday\'s data (Enhanced API):', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.log('⚠️ [Midnight Reset] No yesterday data available');
        setShowOnlyLastLocation(false);
        setLastLocationPoint(null);
        return false;
      }
      
      const result = await response.json();
      
      if (result.success && result.data?.route && result.data.route.length > 0) {
        // Get the last point from yesterday's route
        const lastPoint = result.data.route[result.data.route.length - 1];
        console.log('📍 [Midnight Reset] Found yesterday\'s last location:', {
          lat: lastPoint.lat,
          lng: lastPoint.lng,
          timestamp: lastPoint.timestamp
        });
        
        setLastLocationPoint(lastPoint);
        setShowOnlyLastLocation(true);
        return true;
      } else {
        console.log('⚠️ [Midnight Reset] No route points from yesterday');
        setShowOnlyLastLocation(false);
        setLastLocationPoint(null);
        return false;
      }
    } catch (error) {
      console.error('❌ [Midnight Reset] Error checking midnight reset mode:', error);
      setShowOnlyLastLocation(false);
      setLastLocationPoint(null);
      return false;
    }
  };

  const fetchDriverRouteData = async (materialId: string) => {
    try {
      // ✅ CRITICAL FIX: Get local date string to avoid UTC timezone issues
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      
      console.log(`🌐 [Route Tab] === START FETCH === Date Analysis:`, {
        selectedDateStr: selectedDate.toDateString(),
        selectedDateISO: selectedDate.toISOString(),
        dateStrForAPI: dateStr,
        todayStr,
        isToday,
        selectedDateFull: selectedDate.toString(),
        nowFull: now.toString()
      });
      
      console.log(`🌐 [Route Tab] State before fetch:`, {
        showOnlyLastLocation,
        hasLastLocationPoint: !!lastLocationPoint,
        hasRouteData: !!routeData
      });
      
      // ✅ CRITICAL FIX: Clear midnight reset state IMMEDIATELY for historical dates
      // This prevents race conditions where component renders with stale state
      if (!isToday) {
        console.log('📅 [Route Tab] Historical date detected - clearing midnight reset state IMMEDIATELY');
        setShowOnlyLastLocation(false);
        setLastLocationPoint(null);
      }
      
      // ✅ Check if we're in midnight reset mode (12 AM - 8 AM) - only for TODAY
      const inResetMode = await checkMidnightResetMode(materialId);
      
      console.log(`🌐 [Route Tab] After midnight check:`, {
        inResetMode,
        showOnlyLastLocation,
        isToday
      });
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found for route data fetch');
        setRouteData(null);
        return;
      }

      // ✅ CRITICAL FIX: During midnight reset mode, DON'T fetch today's route/session data
      // BUT still fetch overallCompliance (avg rating) - it should always be visible
      if (inResetMode && isToday) {
        console.log('🌙 [Route Tab] In midnight reset mode - fetching only overallCompliance, skipping route/session data');
        setRouteData(null); // Clear any existing route data
        setSessionStatus(null);
        
        // ✅ Fetch ONLY overallCompliance during lock period
        const sessionUrl = `${API_CONFIG.BASE_URL}/screenTracking/route/${driverInfo?.deviceId || materialId}?date=${dateStr}`;
        
        try {
          const sessionResponse = await fetch(sessionUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (sessionResponse.ok) {
            const sessionResult = await sessionResponse.json();
            
            if (sessionResult.success && sessionResult.data?.overallCompliance) {
              console.log('✅ [Midnight Reset] Fetched overallCompliance:', sessionResult.data.overallCompliance);
              setOverallCompliance({
                complianceRate: sessionResult.data.overallCompliance.complianceRate,
                rating: sessionResult.data.overallCompliance.rating,
                totalDays: sessionResult.data.overallCompliance.totalDays,
                compliantDays: sessionResult.data.overallCompliance.compliantDays
              });
            } else {
              console.log('⚠️ [Midnight Reset] No overallCompliance data available');
            }
          }
        } catch (error) {
          console.error('❌ [Midnight Reset] Error fetching overallCompliance:', error);
        }
        
        return; // Exit early after fetching only overallCompliance
      }

      console.log(`🌐 [Route Tab] Fetching route data for ${dateStr} (isToday: ${isToday})`);
      
      // ✅ FIXED: Match Admin Client behavior - use appropriate endpoint based on date
      if (isToday) {
        // For TODAY - fetch session/compliance data only (GPS comes from WebSocket)
        const sessionUrl = `${API_CONFIG.BASE_URL}/screenTracking/route/${driverInfo?.deviceId || materialId}?date=${dateStr}`;

        console.log(`📅 [Route Tab] Today detected - fetching session data only:`, sessionUrl);
        
        const sessionResponse = await fetch(sessionUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
        if (sessionResponse.ok) {
          try {
            const sessionResult = await sessionResponse.json();
            
            if (sessionResult.success && sessionResult.data) {
              console.log('✅ [Session API] Today\'s data:', {
                hasRoute: !!sessionResult.data.route,
                routePoints: sessionResult.data.route?.length,
                hasSessionStatus: !!sessionResult.data.sessionStatus,
                hasOverallCompliance: !!sessionResult.data.overallCompliance
              });
              
              setRouteData(sessionResult.data);
              
              // ✅ Clear geocoded addresses when route data changes (new date/route)
              setGeocodedAddresses(new Map());
              
              // ✅ Check if all addresses already exist in route data
              if (sessionResult.data.route && sessionResult.data.route.length > 0) {
                const allAddressesExist = sessionResult.data.route.every((point: RoutePoint) => 
                  point.address && point.address.trim() !== ''
                );
                
                if (allAddressesExist) {
                  // All addresses already exist, no geocoding needed
                  setAddressesReady(true);
                  console.log('✅ All addresses already exist in route data');
                } else {
                  // Some addresses missing, start geocoding
                  setAddressesReady(false);
                  const segments = segmentRoute(sessionResult.data.route);
                  geocodeSegmentLocations(segments);
                }
              } else {
                setAddressesReady(false);
              }
              
              if (sessionResult.data.sessionStatus) {
                setSessionStatus({
                  isActive: sessionResult.data.sessionStatus.isActive,
                  startTime: sessionResult.data.sessionStatus.startTime,
                  endTime: sessionResult.data.sessionStatus.endTime || null,
                  currentHours: sessionResult.data.sessionStatus.currentHours,
                  targetHours: sessionResult.data.sessionStatus.targetHours,
                  remainingHours: sessionResult.data.sessionStatus.remainingHours,
                  progressPercent: sessionResult.data.sessionStatus.progressPercent,
                  complianceStatus: sessionResult.data.sessionStatus.complianceStatus
                });
              }
              
              if (sessionResult.data.overallCompliance) {
                setOverallCompliance({
                  complianceRate: sessionResult.data.overallCompliance.complianceRate,
                  rating: sessionResult.data.overallCompliance.rating,
                  totalDays: sessionResult.data.overallCompliance.totalDays,
                  compliantDays: sessionResult.data.overallCompliance.compliantDays
                });
              }
            } else {
              console.warn('⚠️ [Session API] No data for today');
        setRouteData(null);
            }
          } catch (e) {
            console.warn('Failed to parse session data:', e);
            setRouteData(null);
          }
        } else {
          console.warn('Session endpoint failed:', sessionResponse.status);
          setRouteData(null);
        }
      } else {
        // For HISTORICAL dates - use enhanced route endpoint (same as Admin Client)
        const enhancedUrl = `${API_CONFIG.BASE_URL}/api/enhancedRoute/route/${materialId}?date=${dateStr}`;
        
        console.log(`📅 [Route Tab] Historical date - fetching clean GPS data:`, enhancedUrl);
        
        const enhancedResponse = await fetch(enhancedUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (enhancedResponse.ok) {
          try {
            const enhancedResult = await enhancedResponse.json();
            
            console.log('📦 [Enhanced API] Full response:', {
              success: enhancedResult.success,
              hasData: !!enhancedResult.data,
              dataKeys: enhancedResult.data ? Object.keys(enhancedResult.data) : [],
              message: enhancedResult.message
            });
            
            if (enhancedResult.success && enhancedResult.data) {
              console.log('✅ [Enhanced API] Historical GPS data:', {
                date: dateStr,
                pointCount: enhancedResult.data.route?.length,
                hasMetrics: !!enhancedResult.data.metrics,
                totalDistance: enhancedResult.data.metrics?.totalDistance,
                firstPoint: enhancedResult.data.route?.[0],
                lastPoint: enhancedResult.data.route?.[enhancedResult.data.route?.length - 1]
              });
              
              console.log('🔄 [Enhanced API] Setting route data with', enhancedResult.data.route?.length, 'points');
              setRouteData(enhancedResult.data);
              
              // ✅ Clear geocoded addresses when route data changes (new date/route)
              setGeocodedAddresses(new Map());
              
              // ✅ Check if all addresses already exist in route data
              if (enhancedResult.data.route && enhancedResult.data.route.length > 0) {
                const allAddressesExist = enhancedResult.data.route.every((point: RoutePoint) => 
                  point.address && point.address.trim() !== ''
                );
                
                if (allAddressesExist) {
                  // All addresses already exist, no geocoding needed
                  setAddressesReady(true);
                  console.log('✅ All addresses already exist in route data');
                } else {
                  // Some addresses missing, start geocoding
                  setAddressesReady(false);
                  const segments = segmentRoute(enhancedResult.data.route);
                  geocodeSegmentLocations(segments);
                }
              } else {
                setAddressesReady(false);
              }
              
              // For historical dates, session status won't be in enhanced API
              // Clear session status for historical views
              console.log('🔄 [Enhanced API] Clearing session status for historical view');
              setSessionStatus(null);
              setOverallCompliance(null);
              
              console.log('✅ [Enhanced API] Route data set complete');
        } else {
              console.warn('⚠️ [Enhanced API] No historical data for', dateStr, '- Response:', enhancedResult);
          setRouteData(null);
        }
      } catch (e) {
            console.error('❌ [Enhanced API] Failed to parse enhanced route data:', e);
        setRouteData(null);
      }
      } else {
          console.error('❌ [Enhanced API] Endpoint failed with status:', enhancedResponse.status);
          const errorText = await enhancedResponse.text().catch(() => 'Could not read error');
          console.error('❌ [Enhanced API] Error response:', errorText);
        setRouteData(null);
        }
      }
    } catch (err) {
      console.error('Error fetching route data:', err);
      // Don't set error state - just leave route data as null
      setRouteData(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDriverInfoAndRoute(true); // Silent refresh, use native pull indicator
    setRefreshing(false);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (isOnline: boolean): string => {
    return isOnline ? '#22c55e' : '#ef4444';
  };

  const getStatusText = (isOnline: boolean): string => {
    return isOnline ? 'ONLINE' : 'OFFLINE';
  };

  // ✅ Reverse geocoding function to get address from coordinates
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      // Use OpenStreetMap Nominatim API (free, no API key required)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ads2Go-DriverApp/1.0' // Required by Nominatim
        }
      });
      
      if (!response.ok) {
        return '';
      }
      
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        // Build readable address from components
        const parts: string[] = [];
        
        if (addr.road) parts.push(addr.road);
        if (addr.house_number) parts.unshift(addr.house_number);
        if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
        if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
        if (addr.state) parts.push(addr.state);
        if (addr.postcode) parts.push(addr.postcode);
        
        return parts.length > 0 ? parts.join(', ') : data.display_name || '';
      }
      
      return data.display_name || '';
    } catch (error) {
      console.warn('Reverse geocoding error:', error);
      return '';
    }
  };

  // ✅ Geocode addresses for route points that don't have addresses (only for timeline segments)
  const geocodeSegmentLocations = async (segments: Array<{
    type: 'TRAVELED' | 'IDLE';
    startLocation: { lat: number; lng: number; address: string };
    endLocation: { lat: number; lng: number; address: string };
  }>) => {
    if (isGeocoding) return; // Don't start multiple geocoding processes
    
    setIsGeocoding(true);
    setAddressesReady(false); // Mark addresses as not ready
    const newGeocodedAddresses = new Map(geocodedAddresses);
    let geocodedCount = 0;
    
    // Collect unique locations that need geocoding
    const locationsToGeocode: Array<{ lat: number; lng: number; key: string }> = [];
    
    for (const segment of segments) {
      // Check start location
      if (!segment.startLocation.address || segment.startLocation.address.trim() === '') {
        const key = `${segment.startLocation.lat.toFixed(6)},${segment.startLocation.lng.toFixed(6)}`;
        if (!newGeocodedAddresses.has(key) && !locationsToGeocode.find(l => l.key === key)) {
          locationsToGeocode.push({ lat: segment.startLocation.lat, lng: segment.startLocation.lng, key });
        }
      }
      
      // Check end location
      if (!segment.endLocation.address || segment.endLocation.address.trim() === '') {
        const key = `${segment.endLocation.lat.toFixed(6)},${segment.endLocation.lng.toFixed(6)}`;
        if (!newGeocodedAddresses.has(key) && !locationsToGeocode.find(l => l.key === key)) {
          locationsToGeocode.push({ lat: segment.endLocation.lat, lng: segment.endLocation.lng, key });
        }
      }
    }
    
    if (locationsToGeocode.length === 0) {
      setIsGeocoding(false);
      setAddressesReady(true); // All addresses already available
      console.log('✅ All addresses already available, no geocoding needed');
      return; // All addresses already geocoded
    }
    
    console.log(`📍 Geocoding ${locationsToGeocode.length} unique locations for timeline...`);
    
    // Geocode with delay to respect rate limits (max 1 request per second for Nominatim)
    for (let i = 0; i < locationsToGeocode.length; i++) {
      const location = locationsToGeocode[i];
      
      // Geocode with delay
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
      
      const address = await reverseGeocode(location.lat, location.lng);
      if (address) {
        newGeocodedAddresses.set(location.key, address);
        geocodedCount++;
      }
    }
    
    if (geocodedCount > 0) {
      setGeocodedAddresses(newGeocodedAddresses);
      console.log(`✅ Geocoded ${geocodedCount} locations`);
    }
    
    setIsGeocoding(false);
    setAddressesReady(true); // Mark addresses as ready for display
  };
  
  // ✅ Get address for a location (from point address or geocoded cache)
  const getLocationAddress = (lat: number, lng: number, existingAddress?: string): string => {
    // If address already exists, use it
    if (existingAddress && existingAddress.trim() !== '') {
      return existingAddress;
    }
    
    // Check geocoded cache
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const geocodedAddress = geocodedAddresses.get(key);
    if (geocodedAddress) {
      return geocodedAddress;
    }
    
    // ✅ Only return address if addresses are ready
    // If addresses are ready but this location wasn't geocoded, return coordinates as fallback
    // If addresses are not ready yet, return empty string (will show "Loading address...")
    if (addressesReady) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    
    return '';
  };

  // Segment route into movement and idle periods
  const segmentRoute = (points: RoutePoint[]) => {
    if (!points || points.length === 0) return [];

    const segments: Array<{
      type: 'TRAVELED' | 'IDLE';
      startTime: string;
      endTime: string;
      startLocation: { lat: number; lng: number; address: string };
      endLocation: { lat: number; lng: number; address: string };
      distance: number;
      duration: number;
    }> = [];

    let currentSegment: any = null;
    const IDLE_THRESHOLD = 0.05; // km - if distance < 50m, consider it idle
    const MIN_SEGMENT_DURATION = 60; // seconds - minimum duration to create a segment

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (!currentSegment) {
        // Start first segment
        currentSegment = {
          type: 'TRAVELED',
          startTime: point.timestamp,
          endTime: point.timestamp,
          startLocation: { lat: point.lat, lng: point.lng, address: point.address },
          endLocation: { lat: point.lat, lng: point.lng, address: point.address },
          distance: 0,
          duration: 0,
          points: [point]
        };
        continue;
      }

      // Calculate distance from last point in segment
      const lastPoint = currentSegment.points[currentSegment.points.length - 1];
      const distanceFromLast = calculateDistance(
        lastPoint.lat, lastPoint.lng,
        point.lat, point.lng
      );

      // Calculate distance from segment start
      const distanceFromStart = calculateDistance(
        currentSegment.startLocation.lat, currentSegment.startLocation.lng,
        point.lat, point.lng
      );

      // Calculate duration
      const duration = (new Date(point.timestamp).getTime() - new Date(currentSegment.startTime).getTime()) / 1000;

      // Determine if moving or idle based on speed and distance
      const isMoving = point.speed > 1 || distanceFromLast > IDLE_THRESHOLD;

      if (currentSegment.type === 'TRAVELED' && !isMoving && duration > MIN_SEGMENT_DURATION) {
        // Was traveling, now stopped - save traveled segment
        currentSegment.endTime = lastPoint.timestamp;
        currentSegment.endLocation = { 
          lat: lastPoint.lat, 
          lng: lastPoint.lng, 
          address: lastPoint.address 
        };
        currentSegment.duration = (new Date(currentSegment.endTime).getTime() - new Date(currentSegment.startTime).getTime()) / 1000;
        segments.push({ ...currentSegment });

        // Start idle segment
        currentSegment = {
          type: 'IDLE',
          startTime: point.timestamp,
          endTime: point.timestamp,
          startLocation: { lat: point.lat, lng: point.lng, address: point.address },
          endLocation: { lat: point.lat, lng: point.lng, address: point.address },
          distance: 0,
          duration: 0,
          points: [point]
        };
      } else if (currentSegment.type === 'IDLE' && isMoving) {
        // Was idle, now traveling - save idle segment
        currentSegment.endTime = lastPoint.timestamp;
        currentSegment.duration = (new Date(currentSegment.endTime).getTime() - new Date(currentSegment.startTime).getTime()) / 1000;
        if (currentSegment.duration > MIN_SEGMENT_DURATION) {
          segments.push({ ...currentSegment });
        }

        // Start traveling segment
        currentSegment = {
          type: 'TRAVELED',
          startTime: point.timestamp,
          endTime: point.timestamp,
          startLocation: { lat: point.lat, lng: point.lng, address: point.address },
          endLocation: { lat: point.lat, lng: point.lng, address: point.address },
          distance: distanceFromLast,
          duration: 0,
          points: [point]
        };
      } else {
        // Continue current segment
        currentSegment.points.push(point);
        currentSegment.endTime = point.timestamp;
        currentSegment.endLocation = { lat: point.lat, lng: point.lng, address: point.address };
        if (currentSegment.type === 'TRAVELED') {
          currentSegment.distance += distanceFromLast;
        }
        currentSegment.duration = (new Date(currentSegment.endTime).getTime() - new Date(currentSegment.startTime).getTime()) / 1000;
      }
    }

    // Add final segment if it has meaningful duration
    if (currentSegment && currentSegment.duration > MIN_SEGMENT_DURATION) {
      segments.push(currentSegment);
    }

    return segments;
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3674B5" />
        <Text style={styles.loadingText}>Loading route data</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadDriverInfoAndRoute(false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Check if device is not registered
  const isDeviceUnregistered = driverInfo?.deviceId === 'No Device' || 
                                driverInfo?.materialId === 'Not Assigned';

  if (isDeviceUnregistered) {
    return (
      <View style={styles.noDeviceContainer}>
        <View style={styles.noDeviceContent}>
          <View style={styles.noDeviceIconContainer}>
            <Ionicons name="information-circle-outline" size={64} color="#6b7280" />
          </View>
          <Text style={styles.noDeviceTitle}>No Device Registered</Text>
          <Text style={styles.noDeviceMessage}>
            Your device is not currently registered or has been unregistered by an administrator.
          </Text>
          <Text style={styles.noDeviceHint}>
            Please contact support if you need assistance with device registration.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreenContainer}>
      {/* Full Screen Map */}
      <View style={styles.fullScreenMapContainer}>
        {/* ✅ FIXED: Show single marker during midnight reset mode, otherwise show full route */}
        {(() => {
          // During midnight reset mode (12 AM - 8 AM on current day):
          // - showOnlyLastLocation = true
          // - lastLocationPoint = yesterday's last GPS location
          // - routeData = null (we skip the API call)
          const shouldShowSingleMarker = showOnlyLastLocation && lastLocationPoint;
          
          console.log('🗺️ [Map Render] Decision:', {
            date: selectedDate.toDateString(),
            showOnlyLastLocation,
            hasLastLocationPoint: !!lastLocationPoint,
            hasRouteData: !!routeData?.route,
            routePointCount: routeData?.route?.length || 0,
            shouldShowSingleMarker,
            willShow: shouldShowSingleMarker ? 'SINGLE MARKER (Midnight Reset)' : 'FULL ROUTE'
          });
          
          return shouldShowSingleMarker ? (
            <>
              <RouteMapView 
                route={[lastLocationPoint]} 
                style={styles.fullScreenMap}
                showSpeedColors={false}
                showWaypoints={false}
              />
              <View style={styles.midnightResetBanner}>
                <Ionicons name="moon" size={16} color="#f59e0b" />
                <Text style={styles.midnightResetText}>
                  Showing last location from yesterday (driver completed 8 hours). New route will appear when ad player starts at 8 AM.
                </Text>
              </View>
            </>
          ) : (
            <RouteMapView 
              route={routeData?.route || []} 
              style={styles.fullScreenMap}
              showSpeedColors={false}
              showWaypoints={false}
            />
          );
        })()}
        
        {/* Date Selector Overlay on Map */}
        <View style={styles.mapOverlayControls}>
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={styles.dateButtonOverlay}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={20} color="#3674B5" />
              <Text style={styles.dateButtonText}>
                {selectedDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.todayButton,
                isSelectedDateToday() && styles.todayButtonDisabled
              ]}
              onPress={() => {
                if (!isSelectedDateToday()) {
                  const now = new Date();
                  // ✅ Create today's date at midnight to avoid timezone issues
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                  console.log('🎯 [Today Button] Clicked:', {
                    dateStr: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
                    dateString: today.toDateString()
                  });
                  setSelectedDate(today);
                }
              }}
              disabled={isSelectedDateToday()}
              activeOpacity={isSelectedDateToday() ? 1 : 0.7}
            >
              <Text style={[
                styles.todayButtonText,
                isSelectedDateToday() && styles.todayButtonTextDisabled
              ]}>
                Today
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Sheet - Pull Up Feature */}
      <Animated.View 
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: bottomSheetY }],
          },
        ]}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <View style={styles.dragHandleBar} />
        </View>

        {/* Scrollable Content */}
        <View style={styles.bottomSheetScrollContainer}>
          <ScrollView 
            style={styles.bottomSheetContent}
            contentContainerStyle={styles.bottomSheetContentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
          {/* Vehicle/Device Status Card */}
          <View style={styles.vehicleStatusCard}>
            <View style={styles.vehicleStatusHeader}>
              <View style={styles.vehicleIdContainer}>
              <Text style={styles.vehicleIdText}>{driverInfo?.driverId}</Text>                
              <Text style={styles.deviceIdText}>{driverInfo?.materialId}</Text>
              </View>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, !isAdPlayerOnline && styles.statusBadgeOffline]}>
                  <View style={[styles.statusDot, isAdPlayerOnline && styles.statusDotOnline]} />
                  <Text style={[styles.statusText, isAdPlayerOnline && styles.statusTextOnline]}>
                    {isAdPlayerOnline ? 'ONLINE' : 'OFFLINE'}
                  </Text>
                </View>
                {/* Real-time indicator */}
                {lastUpdate && (
                  <Text style={styles.lastUpdateText}>
                    {isRealTimeActive ? 'Real time:' : 'Updated:'} {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                )}
              </View>
            </View>
            
            {/* Route Statistics - 2x2 Grid with 3 items (Avg Speed centered) */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={styles.metricValue}>
                  {routeData?.metrics?.totalDistance?.toFixed(2) || '0.00'} km
                </Text>
              </View>
              
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Duration</Text>
                <Text style={styles.metricValue}>
                  {/* ✅ FIXED: Use sessionStatus.currentHours for today's date to match dashboard */}
                  {isSelectedDateToday() && sessionStatus?.currentHours !== undefined
                    ? `${sessionStatus.currentHours.toFixed(2)}h`
                    : routeData?.metrics?.totalDuration
                    ? formatDuration(routeData.metrics.totalDuration)
                    : '0 sec'}
                </Text>
              </View>
              
              <View style={styles.metricCardWrapper}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Avg Speed</Text>
                  <Text style={styles.metricValue}>
                    {routeData?.metrics?.averageSpeed?.toFixed(1) || '0.0'} km/h
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Session Status Card (8-Hour Requirement) */}
      {selectedDate.toDateString() === new Date().toDateString() && (
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionTitle}>Daily 8-Hour Requirement</Text>
          </View>
          
          {/* ✅ NEW: Overall Compliance Rating */}
          {overallCompliance && (
            <View style={[
              styles.overallComplianceCard,
              overallCompliance.rating === 'VERY GOOD' && styles.veryGoodCard,
              overallCompliance.rating === 'GOOD' && styles.goodCard,
              overallCompliance.rating === 'AVERAGE' && styles.averageCard
            ]}>
              <View style={styles.ratingRow}>
                <View style={styles.ratingBadge}>
                  <Text style={[
                    styles.ratingText,
                    overallCompliance.rating === 'VERY GOOD' && { color: '#16a34a' },
                    overallCompliance.rating === 'GOOD' && { color: '#2563eb' },
                    overallCompliance.rating === 'AVERAGE' && { color: '#f59e0b' }
                  ]}>
                    {overallCompliance.rating === 'VERY GOOD' && 'VERY GOOD'}
                    {overallCompliance.rating === 'GOOD' && 'GOOD'}
                    {overallCompliance.rating === 'AVERAGE' && 'AVERAGE'}
                  </Text>
                </View>
                <Text style={styles.compliancePercent}>
                  {overallCompliance.complianceRate.toFixed(1)}%
                </Text>
              </View>
              <Text style={styles.complianceSubtext}>
                {overallCompliance.compliantDays} of {overallCompliance.totalDays} days completed (since first trip)
              </Text>
            </View>
          )}
          
          {sessionStatus && sessionStatus.currentHours >= sessionStatus.targetHours ? (
            // ✅ ACTUALLY COMPLETED (reached 8 hours)
            <View style={styles.sessionCompleted}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.sessionCompletedTitle}>8-Hour Requirement Completed!</Text>
              <Text style={styles.sessionCompletedText}>
                You completed {sessionStatus.currentHours.toFixed(2)} hours today
              </Text>
              <Text style={styles.sessionCompletedTime}>
                {sessionStatus.startTime ? new Date(sessionStatus.startTime).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit'
                }) : 'N/A'} - {sessionStatus.endTime ? new Date(sessionStatus.endTime).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit'
                }) : 'In Progress'}
              </Text>
            </View>
          ) : sessionStatus ? (
            // ⏳ IN PROGRESS (has sessionStatus but not yet 8 hours - show progress)
            <View style={styles.sessionContent}>
              <View style={styles.sessionStats}>
                <View style={styles.sessionStatItem}>
                  <Text style={styles.sessionStatLabel}>Current Hours</Text>
                  <Text style={styles.sessionStatValue}>
                    {sessionStatus.currentHours.toFixed(2)} / {sessionStatus.targetHours}h
                  </Text>
                </View>
                <View style={styles.sessionStatItem}>
                  <Text style={styles.sessionStatLabel}>Remaining</Text>
                  <Text style={styles.sessionStatValue}>
                    {sessionStatus.remainingHours.toFixed(2)}h
                  </Text>
                </View>
              </View>
              
              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { 
                      width: `${sessionStatus.progressPercent}%`,
                      backgroundColor: overallCompliance?.rating === 'VERY GOOD' ? '#16a34a' : 
                                       overallCompliance?.rating === 'GOOD' ? '#2563eb' : 
                                       overallCompliance?.rating === 'AVERAGE' ? '#f59e0b' : '#3674B5'
                    }
                  ]} />
                </View>
                <Text style={styles.progressText}>
                  {sessionStatus.progressPercent.toFixed(1)}% Complete
                </Text>
              </View>
              
              <View style={styles.sessionTimeInfo}>
                <Text style={styles.sessionTimeText}>
                  Started: {sessionStatus.startTime ? new Date(sessionStatus.startTime).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  }) : 'N/A'}
                </Text>
                {sessionStatus.complianceStatus === 'COMPLIANT' && sessionStatus.endTime && (
                  <Text style={[styles.sessionTimeText, { color: '#22c55e', fontWeight: '600' }]}>
                    ✅ Completed at {new Date(sessionStatus.endTime).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            // Session Not Started - Only shows if sessionStatus is null
            <View style={styles.sessionNotStarted}>
              <View style={styles.autoStartInfo}>
                <Text style={styles.autoStartText}>
                  Your 8-hour tracking begins automatically when the ad player device connects and starts running.
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

          {/* Route Timeline Section */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Route Timeline</Text>
            </View>
            
            {routeData && routeData.route.length > 0 ? (
              addressesReady ? (
                <RouteTimelineView
                  route={routeData.route}
                  segmentRoute={segmentRoute}
                  formatTime={formatTime}
                  formatDuration={formatDuration}
                  geocodeSegmentLocations={geocodeSegmentLocations}
                  getLocationAddress={getLocationAddress}
                  isGeocoding={isGeocoding}
                  addressesReady={addressesReady}
                />
              ) : (
                <View style={styles.timelineLoadingContainer}>
                  <ActivityIndicator size="large" color="#3674B5" />
                  <Text style={styles.timelineLoadingText}>Loading addresses</Text>
                </View>
              )
            ) : (
              <View style={styles.noDataContainer}>
                <Ionicons name="location-outline" size={32} color="#9ca3af" />
                <Text style={styles.noDataText}>
                  {driverInfo?.deviceId === 'No Device' || driverInfo?.deviceId === 'Unknown' 
                    ? 'No device registered yet' 
                    : 'No route data available'}
                </Text>
                <Text style={styles.noDataSubtext}>
                  {driverInfo?.deviceId === 'No Device' || driverInfo?.deviceId === 'Unknown'
                    ? 'Please contact admin to register your device and start tracking'
                    : 'Route data will appear when GPS tracking is active'}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </Animated.View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.dateList}>
              {/* Generate dates from assigned date to today */}
              {(() => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                
                // ✅ Calculate days to show based on assigned date
                let daysToShow = 0; // Default to 0 (show nothing if no assigned date)
                
                if (driverInfo?.materialAssignedDate) {
                  const assignedDate = new Date(driverInfo.materialAssignedDate);
                  assignedDate.setHours(0, 0, 0, 0);
                  
                  // Calculate days from assignment to today
                  const daysSinceAssignment = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  daysToShow = daysSinceAssignment;
                  
                  console.log('📅 [Date Dropdown] Calculated:', {
                    assignedDate: assignedDate.toDateString(),
                    today: now.toDateString(),
                    daysSinceAssignment,
                    daysToShow
                  });
                } else {
                  console.log('⚠️ [Date Dropdown] No assigned date - showing no dates');
                }
                
                // If no dates to show, display a message
                if (daysToShow === 0) {
                  return (
                    <View style={styles.noDateContainer}>
                      <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                      <Text style={styles.noDateText}>No dates available</Text>
                      <Text style={styles.noDateSubtext}>No material assigned yet</Text>
                    </View>
                  );
                }
                
                return Array.from({ length: daysToShow }, (_, i) => {
                  // ✅ CRITICAL FIX: Create date at midnight to avoid timezone issues
                  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
                const isSelected = date.toDateString() === selectedDate.toDateString();
                
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                    onPress={() => {
                      const selectedYear = date.getFullYear();
                      const selectedMonth = date.getMonth() + 1;
                      const selectedDay = date.getDate();
                      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
                      
                      console.log(`🎯 [Date Picker] Selected:`, {
                        dateStr,
                        dateString: date.toDateString()
                      });
                      setSelectedDate(date);
                      setShowDatePicker(false);
                    }}
                  >
                    <View style={styles.dateItemContent}>
                      <Text style={[styles.dateItemText, isSelected && styles.dateItemTextSelected]}>
                        {date.toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#3674B5" />
                      )}
                    </View>
                    {i === 0 && <View style={styles.todayBadgeInline}>
                            <Text style={styles.todayBadgeInlineText}>Today</Text>
                          </View>}
                  </TouchableOpacity>
                );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ✅ Route Timeline View Component with Geocoding
interface RouteTimelineViewProps {
  route: RoutePoint[];
  segmentRoute: (points: RoutePoint[]) => Array<{
    type: 'TRAVELED' | 'IDLE';
    startTime: string;
    endTime: string;
    startLocation: { lat: number; lng: number; address: string };
    endLocation: { lat: number; lng: number; address: string };
    distance: number;
    duration: number;
  }>;
  formatTime: (timestamp: string) => string;
  formatDuration: (seconds: number) => string;
  geocodeSegmentLocations: (segments: Array<{
    type: 'TRAVELED' | 'IDLE';
    startLocation: { lat: number; lng: number; address: string };
    endLocation: { lat: number; lng: number; address: string };
  }>) => Promise<void>;
  getLocationAddress: (lat: number, lng: number, existingAddress?: string) => string;
  isGeocoding: boolean;
  addressesReady: boolean;
}

const RouteTimelineView: React.FC<RouteTimelineViewProps> = ({
  route,
  segmentRoute,
  formatTime,
  formatDuration,
  geocodeSegmentLocations,
  getLocationAddress,
  isGeocoding,
  addressesReady
}) => {
  const segments = segmentRoute(route);
  
  return (
    <ScrollView style={styles.timelineContainer} nestedScrollEnabled>
      {isGeocoding && (
        <View style={styles.geocodingIndicator}>
          <ActivityIndicator size="small" color="#3674B5" />
          <Text style={styles.geocodingText}>Loading addresses</Text>
        </View>
      )}
      {segments.map((segment, index) => {
        const startAddress = getLocationAddress(
          segment.startLocation.lat,
          segment.startLocation.lng,
          segment.startLocation.address
        );
        const endAddress = getLocationAddress(
          segment.endLocation.lat,
          segment.endLocation.lng,
          segment.endLocation.address
        );
        
        // ✅ Show address or placeholder
        // If address is empty and addresses are ready, it means geocoding failed - show coordinates
        // If address is empty and addresses not ready, show loading placeholder
        const displayStartAddress = startAddress || (addressesReady ? `${segment.startLocation.lat.toFixed(6)}, ${segment.startLocation.lng.toFixed(6)}` : 'Loading address...');
        const displayEndAddress = endAddress || (addressesReady ? `${segment.endLocation.lat.toFixed(6)}, ${segment.endLocation.lng.toFixed(6)}` : 'Loading address...');
        
        return (
          <View key={index} style={styles.timelineItem}>
            <View style={styles.timelineIconContainer}>
              {segment.type === 'TRAVELED' ? (
                <View style={[styles.timelineIcon, { backgroundColor: '#22c55e' }]}>
                  <Ionicons name="car" size={16} color="#ffffff" />
                </View>
              ) : (
                <View style={[styles.timelineIcon, { backgroundColor: '#f59e0b' }]}>
                  <Ionicons name="pause" size={16} color="#ffffff" />
                </View>
              )}
              {index < segments.length - 1 && (
                <View style={styles.timelineLine} />
              )}
            </View>
            
            <View style={styles.timelineContent}>
              <View style={styles.timelineHeader}>
                <Text style={styles.timelineTime}>
                  {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                </Text>
                <Text style={[
                  styles.timelineType,
                  { color: segment.type === 'TRAVELED' ? '#22c55e' : '#f59e0b' }
                ]}>
                  {segment.type === 'TRAVELED' ? 'TRAVELED' : 'IDLE/STOPPED'}
                </Text>
              </View>
              
              {segment.type === 'TRAVELED' ? (
                <View style={styles.timelineDetails}>
                  <View style={styles.locationRow}>
                    <Ionicons name="navigate" size={14} color="#3674B5" />
                    <Text style={styles.locationText} numberOfLines={2}>
                      From: {displayStartAddress}
                    </Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="#ef4444" />
                    <Text style={styles.locationText} numberOfLines={2}>
                      To: {displayEndAddress}
                    </Text>
                  </View>
                  <Text style={styles.distanceText}>
                    Distance: {segment.distance.toFixed(2)} km • Duration: {formatDuration(segment.duration)}
                  </Text>
                </View>
              ) : (
                <View style={styles.timelineDetails}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="#f59e0b" />
                    <Text style={styles.locationText} numberOfLines={2}>
                      Stopped at: {displayStartAddress}
                    </Text>
                  </View>
                  <Text style={styles.distanceText}>
                    Duration: {formatDuration(segment.duration)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  fullScreenMapContainer: {
    flex: 1,
    position: 'relative',
  },
  fullScreenMap: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapOverlayControls: {
    position: 'absolute',
    top: 50,
    left: 55,
    right: 20,
    zIndex: 10,
    width: '85%',
  },
  dateButtonOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    gap: 8,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: screenHeight,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#ffffff',
    zIndex: 1,
    minHeight: 50,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  bottomSheetScrollContainer: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
  },
  bottomSheetContentContainer: {
    paddingBottom: 100,
    paddingTop: 0,
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'right',
  },
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
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  noDeviceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  noDeviceContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  noDeviceIconContainer: {
    marginBottom: 20,
  },
  noDeviceTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  noDeviceMessage: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  noDeviceHint: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3674B5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  onlineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  onlineStatusOnline: {
    backgroundColor: '#dcfce7',
  },
  onlineStatusOffline: {
    backgroundColor: '#fee2e2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  statusDotOnline: {
    backgroundColor: '#22c55e',
  },
  onlineStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  onlineStatusTextOnline: {
    color: '#16a34a',
  },
  lastSeenText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  refreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 6,
  },
  refreshText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  driverInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  statusCard: {
    margin: 20,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 70,
    borderWidth: 0,
    overflow: 'hidden',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  metricsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  metricsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  vehicleStatusCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  vehicleIdContainer: {
    flex: 1,
  },
  vehicleIdText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  deviceIdText: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    gap: 6,
  },
  statusBadgeOffline: {
    backgroundColor: '#fee2e2',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  statusTextOnline: {
    color: '#16a34a',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricCardWrapper: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  mapContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  mapWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  midnightResetBanner: {
    position: 'absolute',
    top: 100,
    left: 55,
    right: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.95)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    width: '85%',
  },
  midnightResetText: {
    flex: 1,
    fontSize: 12,
    color: '#78350f',
    fontWeight: '500',
    lineHeight: 16,
  },
  map: {
    height: 300,
    width: '100%',
  },
  bottomSpacing: {
    height: 60,
  },

  // Date and Controls Styles
  controlsCard: {
    marginTop: 10,
    marginBottom: 20,
    padding: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    gap: 8,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 4,
  },
  todayButton: {
    backgroundColor: '#3674B5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginLeft: 8,
  },
  todayButtonDisabled: {
    backgroundColor: '#dfdfdf',
    shadowOpacity: 0,
    elevation: 0,
  },
  todayButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  todayButtonTextDisabled: {
    color: '#9CA3AF',
  },  
  // Date Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  dateList: {
    maxHeight: 400,
  },
  dateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dateItemSelected: {
    backgroundColor: '#eff6ff',
  },
  dateItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dateItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  dateItemTextSelected: {
    color: '#3674B5',
    fontWeight: '600',
  },
  todayBadgeInline: {
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayBadgeInlineText: {
    color: '#3674B5',
    fontSize: 11,
    fontWeight: '600',
  },
  noDateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  noDateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  
  // Timeline Styles
  timelineContainer: {
    maxHeight: 400,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineIconContainer: {
    alignItems: 'center',
    width: 40,
    marginRight: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0,
    overflow: 'hidden',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  timelineType: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineDetails: {
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
    lineHeight: 18,
  },
  distanceText: {
    fontSize: 12,
    color: '#000',
    marginTop: 4,
    fontWeight: '400',
  },
  geocodingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  geocodingText: {
    fontSize: 12,
    color: '#3674B5',
    fontWeight: '500',
  },
  timelineLoadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  
  // Session Status Styles (8-Hour Requirement)
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  sessionContent: {
    gap: 16,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  sessionStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  sessionStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  progressContainer: {
    gap: 8,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sessionTimeInfo: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sessionTimeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  sessionCompleted: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  sessionCompletedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
    marginTop: 8,
  },
  sessionCompletedText: {
    fontSize: 15,
    color: '#6b7280',
  },
  sessionCompletedTime: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  sessionNotStarted: {
    alignItems: 'center',
    gap: 16,
  },
  autoStartInfo: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 10,
    gap: 12,
  },
  autoStartText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
    textAlign: 'center',
  },
  
  // ✅ NEW: Overall Compliance Rating Styles
  overallComplianceCard: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 8,
  },
  veryGoodCard: {
    backgroundColor: '#f0fdf4',
  },
  goodCard: {
    backgroundColor: '#eff6ff',
  },
  averageCard: {
    backgroundColor: '#fffbeb',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
  },
  compliancePercent: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  complianceSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
});

export default RouteTab;
