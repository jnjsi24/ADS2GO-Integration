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
  RefreshControl
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

  useEffect(() => {
    loadDriverInfoAndRoute();
  }, []);

  const loadDriverInfoAndRoute = async () => {
    try {
      setLoading(true);
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
        throw new Error(`Failed to fetch driver info: ${driverResponse.status}`);
      }

      const driverData = await driverResponse.json();
      if (!driverData.success) {
        throw new Error(driverData.message || 'Failed to fetch driver info');
      }

      const materialId = driverData.data.materialId;
      const deviceId = driverData.data.deviceId;

      setDriverInfo({
        driverId,
        materialId,
        deviceId
      });

      // Fetch route data using driver-specific endpoint
      await fetchDriverRouteData(driverId);

    } catch (err) {
      console.error('Error loading driver info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverRouteData = async (driverId: string) => {
    try {
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/screenTracking/driverRoute/${driverId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      
      if (result.success) {
        setRouteData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch route data');
      }
    } catch (err) {
      console.error('Error fetching route data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch route data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDriverInfoAndRoute();
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

  const getStatusColor = (isOnline: boolean): string => {
    return isOnline ? '#22c55e' : '#ef4444';
  };

  const getStatusText = (isOnline: boolean): string => {
    return isOnline ? 'ONLINE' : 'OFFLINE';
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
        <TouchableOpacity style={styles.retryButton} onPress={loadDriverInfoAndRoute}>
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
        <Text style={styles.headerTitle}>Route Tracking</Text>
        <Text style={styles.headerSubtitle}>GPS Route Visualization</Text>
        
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

      {/* Route Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons name="map" size={24} color="#3b82f6" />
          <Text style={styles.statusTitle}>Route Status</Text>
        </View>
        
        {routeData ? (
          <View style={styles.statusContent}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Device ID:</Text>
              <Text style={styles.statusValue} numberOfLines={1} ellipsizeMode="middle">
                {routeData.deviceId}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>GPS Points:</Text>
              <Text style={styles.statusValue}>{routeData.metrics.pointCount}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Last Update:</Text>
              <Text style={styles.statusValue}>
                {routeData.metrics.endTime ? formatTimestamp(routeData.metrics.endTime) : 'N/A'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="location-outline" size={32} color="#9ca3af" />
            <Text style={styles.noDataText}>No route data available</Text>
            <Text style={styles.noDataSubtext}>
              Route data will appear when GPS tracking is active
            </Text>
          </View>
        )}
      </View>

      {/* Route Metrics */}
      {routeData && routeData.metrics && (
        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>Route Statistics</Text>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="speedometer" size={24} color="#22c55e" />
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{routeData.metrics.totalDistance.toFixed(2)} km</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Ionicons name="time" size={24} color="#3b82f6" />
              <Text style={styles.metricLabel}>Duration</Text>
              <Text style={styles.metricValue}>{formatDuration(routeData.metrics.totalDuration)}</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Ionicons name="trending-up" size={24} color="#f59e0b" />
              <Text style={styles.metricLabel}>Avg Speed</Text>
              <Text style={styles.metricValue}>{routeData.metrics.averageSpeed.toFixed(1)} km/h</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Ionicons name="location" size={24} color="#8b5cf6" />
              <Text style={styles.metricLabel}>Points</Text>
              <Text style={styles.metricValue}>{routeData.metrics.pointCount}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Interactive Route Map */}
      <View style={styles.mapContainer}>
        <Text style={styles.mapTitle}>Route Visualization</Text>
        <View style={styles.mapWrapper}>
          <RouteMapView 
            route={routeData?.route || []} 
            style={styles.map}
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
});

export default RouteTab;
