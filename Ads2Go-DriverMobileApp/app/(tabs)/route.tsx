import React, { useState, useEffect } from 'react';
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
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import RouteMapView from '../../components/RouteMapView';

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

  useEffect(() => {
    console.log('🔄 [Route Tab] Date changed to:', selectedDate.toISOString().split('T')[0]);
    loadDriverInfoAndRoute(false); // Initial load with loading screen

    // Auto-refresh every 30 seconds for today's date only
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    if (isToday) {
      console.log('📅 [Route Tab] Today detected - enabling auto-refresh');
      refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing route data...');
        loadDriverInfoAndRoute(true); // Silent background refresh
      }, 30000); // 30 seconds
    } else {
      console.log('📅 [Route Tab] Historical date - no auto-refresh');
    }

    // Cleanup interval on unmount or date change
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [selectedDate]); // Reload when date changes

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

      setDriverInfo({
        driverId,
        materialId,
        deviceId
      });

      // Use deviceId if available, otherwise use materialId as fallback
      const identifierForRoute = (deviceId && deviceId !== 'Unknown' && deviceId !== 'No Device') 
        ? deviceId 
        : materialId;

      console.log('🆔 [Route Tab] Using identifier for route:', identifierForRoute);

      // Only fetch route data if we have a valid identifier
      if (identifierForRoute && identifierForRoute !== 'Not Assigned') {
        await fetchDriverRouteData(identifierForRoute);
      } else {
        console.log('ℹ️ [Route Tab] No valid identifier, skipping route fetch - device not registered');
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

  const fetchDriverRouteData = async (deviceId: string) => {
    try {
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('No auth token found for route data fetch');
        setRouteData(null);
        return;
      }

      // Format date for API (YYYY-MM-DD)
      const dateStr = selectedDate.toISOString().split('T')[0];
      const url = `${API_CONFIG.BASE_URL}/screenTracking/route/${deviceId}?date=${dateStr}`;
      
      console.log('🗺️ Fetching route data for date:', dateStr);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn('Route endpoint failed:', response.status);
        setRouteData(null);
        return;
      }
      
      let result: any;
      try {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          result = await response.json();
        } else {
          const text = await response.text();
          console.warn('Unexpected content-type for route data:', ct, text?.slice(0, 200));
          setRouteData(null);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse route data:', e);
        setRouteData(null);
        return;
      }
      
      if (result.success) {
        console.log('✅ Route data received successfully');
        console.log('📊 Route points:', result.data?.route?.length || 0);
        console.log('📍 First point:', result.data?.route?.[0]);
        console.log('📍 Last point:', result.data?.route?.[result.data.route?.length - 1]);
        console.log('📈 Metrics:', result.data?.metrics);
        setRouteData(result.data);
      } else {
        console.warn('❌ Route data fetch unsuccessful:', result.message);
        setRouteData(null);
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
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading route data...</Text>
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
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Route Tracking</Text>
        <Text style={styles.headerSubtitle}>GPS Route Visualization</Text>
        
        {/* Auto-refresh indicator */}
        {lastUpdate && (
          <View style={styles.refreshIndicator}>
            <Ionicons 
              name="sync" 
              size={12} 
              color={selectedDate.toDateString() === new Date().toDateString() ? '#22c55e' : '#9ca3af'} 
            />
            <Text style={styles.refreshText}>
              {selectedDate.toDateString() === new Date().toDateString() 
                ? `Auto-updating • Last: ${lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                : `Updated: ${lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              }
            </Text>
          </View>
        )}
        
        {driverInfo && (
          <View style={styles.driverInfo}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="person" size={16} color="#3b82f6" />
                <Text style={styles.infoLabel}>Driver</Text>
                <Text style={styles.infoValue}>{driverInfo.driverId}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="cube" size={16} color="#3b82f6" />
                <Text style={styles.infoLabel}>Material</Text>
                <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
                  {driverInfo.materialId}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Date Selector */}
      <View style={styles.controlsCard}>
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color="#3b82f6" />
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
            style={styles.todayButton}
            onPress={() => setSelectedDate(new Date())}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>

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
              {/* Generate last 30 days */}
              {Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const isSelected = date.toDateString() === selectedDate.toDateString();
                
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                    onPress={() => {
                      setSelectedDate(date);
                      setShowDatePicker(false);
                    }}
                  >
                    <View style={styles.dateItemContent}>
                      <Text style={[styles.dateItemText, isSelected && styles.dateItemTextSelected]}>
                        {date.toLocaleDateString('en-US', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
                      )}
                    </View>
                    {i === 0 && <Text style={styles.todayBadge}>Today</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Route Statistics - Always show */}
      <View style={styles.metricsContainer}>
        <Text style={styles.metricsTitle}>Route Statistics</Text>
        
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="speedometer" size={24} color="#22c55e" />
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>
              {routeData?.metrics?.totalDistance?.toFixed(2) || '0.00'} km
            </Text>
          </View>
          
          <View style={styles.metricCard}>
            <Ionicons name="time" size={24} color="#3b82f6" />
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>
              {routeData?.metrics?.totalDuration ? formatDuration(routeData.metrics.totalDuration) : '0s'}
            </Text>
          </View>
          
          <View style={styles.metricCard}>
            <Ionicons name="trending-up" size={24} color="#f59e0b" />
            <Text style={styles.metricLabel}>Avg Speed</Text>
            <Text style={styles.metricValue}>
              {routeData?.metrics?.averageSpeed?.toFixed(1) || '0.0'} km/h
            </Text>
          </View>
          
          <View style={styles.metricCard}>
            <Ionicons name="location" size={24} color="#8b5cf6" />
            <Text style={styles.metricLabel}>Points</Text>
            <Text style={styles.metricValue}>
              {routeData?.metrics?.pointCount || routeData?.route?.length || 0}
            </Text>
          </View>
        </View>
      </View>

      {/* Route Status Timeline */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons name="time" size={24} color="#3b82f6" />
          <Text style={styles.statusTitle}>Route Timeline</Text>
        </View>
        
        {routeData && routeData.route.length > 0 ? (
          <ScrollView style={styles.timelineContainer} nestedScrollEnabled>
            {segmentRoute(routeData.route).map((segment, index) => (
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
                  {index < segmentRoute(routeData.route).length - 1 && (
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
                        <Ionicons name="navigate" size={14} color="#3b82f6" />
                        <Text style={styles.locationText} numberOfLines={2}>
                          From: {segment.startLocation.address || 
                            `${segment.startLocation.lat.toFixed(6)}, ${segment.startLocation.lng.toFixed(6)}`}
                        </Text>
                      </View>
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={14} color="#ef4444" />
                        <Text style={styles.locationText} numberOfLines={2}>
                          To: {segment.endLocation.address || 
                            `${segment.endLocation.lat.toFixed(6)}, ${segment.endLocation.lng.toFixed(6)}`}
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
                          Stopped at: {segment.startLocation.address || 
                            `${segment.startLocation.lat.toFixed(6)}, ${segment.startLocation.lng.toFixed(6)}`}
                        </Text>
                      </View>
                      <Text style={styles.distanceText}>
                        Duration: {formatDuration(segment.duration)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
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

      {/* Interactive Route Map */}
      <View style={styles.mapContainer}>
        <View style={styles.mapWrapper}>
          <RouteMapView 
            route={routeData?.route || []} 
            style={styles.map}
            showSpeedColors={false}
            showWaypoints={false}
          />
        </View>
      </View>

      {/* Route Points List */}
      {routeData && routeData.route.length > 0 && (
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsTitle}>Recent GPS Points</Text>
          <ScrollView style={styles.pointsList} nestedScrollEnabled>
            {routeData.route.slice(-10).reverse().map((point, index) => (
              <View key={index} style={styles.pointItem}>
                <View style={styles.pointHeader}>
                  <Ionicons name="location" size={16} color="#3b82f6" />
                  <Text style={styles.pointCoordinates}>
                    {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </Text>
                  <Text style={styles.pointTime}>
                    {formatTimestamp(point.timestamp)}
                  </Text>
                </View>
                <View style={styles.pointDetails}>
                  <Text style={styles.pointDetail}>
                    Speed: {point.speed.toFixed(1)} km/h
                  </Text>
                  <Text style={styles.pointDetail}>
                    Accuracy: {point.accuracy.toFixed(1)}m
                  </Text>
                  {point.address && (
                    <Text style={styles.pointAddress} numberOfLines={1}>
                      {point.address}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

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
    backgroundColor: '#3b82f6',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    marginLeft: 8,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
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
  map: {
    height: 300,
    width: '100%',
  },
  pointsContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  pointsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  pointsList: {
    maxHeight: 300,
  },
  pointItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointCoordinates: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 6,
    flex: 1,
  },
  pointTime: {
    fontSize: 10,
    color: '#6b7280',
  },
  pointDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointDetail: {
    fontSize: 11,
    color: '#6b7280',
  },
  pointAddress: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    flex: 1,
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 20,
  },

  // Date and Controls Styles
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
    marginRight: 8,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    marginRight: 8,
    flex: 1,
  },
  todayButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  dateList: {
    padding: 10,
  },
  dateItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  dateItemSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  dateItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  dateItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  todayBadge: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '700',
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
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
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
    color: '#9ca3af',
    marginTop: 4,
    fontWeight: '600',
  },
});

export default RouteTab;
