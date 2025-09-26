import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';

const { width: screenWidth } = Dimensions.get('window');


interface DriverAnalytics {
  driverId: string;
  vehiclePlateNumber: string;
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
  dailyPerformance: Array<{
    date: string;
    totalDistance: number;
    totalHours: number;
    averageSpeed: number;
    maxSpeed: number;
    qrImpressions: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    distance: number;
    hours: number;
    earnings: number;
    compliance: number;
  }>;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'monthly'>('daily');
  const [selectedMetric, setSelectedMetric] = useState<'distance' | 'hours' | 'speed' | 'qrImpressions'>('distance');


  useEffect(() => {
    // Load user data and analytics
    const loadData = async () => {
      setLoading(true);
      try {
        // Load user data from AsyncStorage
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        if (driverInfo) {
          const driver = JSON.parse(driverInfo);
          setUser(driver);
          
          // Use driverId (string like "DRV-008") instead of _id (ObjectId)
          const driverId = driver.driverId || driver.id;
          console.log('🔍 Initial load - Fetching analytics for driverId:', driverId);
          
          // Fetch real analytics data
          await fetchDriverAnalytics(driverId);
        } else {
          // No driver info found
          console.log('❌ No driver info found in AsyncStorage');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
    
    // Auto-refresh every 30 seconds for real-time updates (reduced frequency)
    const refreshInterval = setInterval(async () => {
      const driverInfo = await AsyncStorage.getItem('driverInfo');
      if (driverInfo) {
        const driver = JSON.parse(driverInfo);
        const driverId = driver.driverId || driver.id;
        if (driverId) {
          // Silent refresh - no console logs
          await fetchDriverAnalytics(driverId, true);
        }
      }
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, []); // Empty dependency array to prevent infinite loops

  const fetchDriverAnalytics = async (driverId: string, silent: boolean = false) => {
    try {
      if (!silent) {
        console.log('🔍 fetchDriverAnalytics called with driverId:', driverId);
      }
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }
      if (!silent) {
        console.log('✅ Auth token found');
      }

      // Fetch real-time ScreenTracking data
      const apiUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}`;
      if (!silent) {
        console.log('🌐 API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
        console.log('🌐 Fetching from URL:', apiUrl);
      }
      
      const dailyResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!dailyResponse.ok) {
        if (!silent) {
          console.error('❌ HTTP error:', dailyResponse.status, dailyResponse.statusText);
        }
        throw new Error(`HTTP error! status: ${dailyResponse.status}`);
      }

      const screenTrackingData = await dailyResponse.json();
      if (!silent) {
        console.log('📊 ScreenTracking response:', screenTrackingData);
      }
      
      if (screenTrackingData.success) {
        const data = screenTrackingData.data;
        
        // Helper function to sanitize numeric values
        const sanitizeNumeric = (value: any, defaultValue: number = 0): number => {
          if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
            return defaultValue;
          }
          return Math.max(0, Number(value));
        };

        // Transform ScreenTracking data to match our interface
        const transformedAnalytics: DriverAnalytics = {
          driverId: data.driverId || 'Unknown',
          vehiclePlateNumber: data.vehiclePlateNumber || 'Unknown',
          vehicleType: data.vehicleType || 'Unknown',
          deviceId: data.deviceId || 'Unknown',
          screenType: data.screenType || 'Unknown',
          materialId: data.materialId || 'Unknown',
          totalDistance: sanitizeNumeric(data.totalDistanceToday, 0),
          totalHours: sanitizeNumeric(data.currentHours, 0),
          hoursRemaining: sanitizeNumeric(data.hoursRemaining, 0),
          averageSpeed: sanitizeNumeric(data.averageSpeed, 0),
          maxSpeed: sanitizeNumeric(data.maxSpeed, 0),
          qrImpressions: sanitizeNumeric(data.qrImpressions || data.totalQrScans || 0, 0),
          totalRoutes: 1, // Single route for current session
          isOnline: Boolean(data.isOnline),
          dailyPerformance: (data.dailyPerformance || []).map((day: any) => ({
            date: day.date || new Date().toISOString(),
            totalDistance: sanitizeNumeric(day.totalDistance, 0),
            totalHours: sanitizeNumeric(day.totalHours, 0),
            averageSpeed: sanitizeNumeric(day.averageSpeed, 0),
            maxSpeed: sanitizeNumeric(day.maxSpeed, 0),
            qrImpressions: sanitizeNumeric(day.qrImpressions || day.totalQrScans || 0, 0)
          })),
          monthlyTrends: [] // Will be populated if needed
        };
        
        setAnalytics(transformedAnalytics);
      } else {
        throw new Error(screenTrackingData.message || 'Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Error fetching driver analytics:', error);
      Alert.alert(
        'Error',
        'Failed to load analytics data. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Helper function to sanitize data for charts
  const sanitizeChartValue = (value: any): number => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Math.max(0, Number(value)); // Ensure non-negative values
  };

  const getChartData = () => {
    if (!analytics) return null;

    if (selectedPeriod === 'daily') {
      const data = analytics.dailyPerformance.slice(-7); // Last 7 days
      
      // Ensure we have at least some data points
      if (data.length === 0) {
        return {
          labels: ['No Data'],
          datasets: [{
            data: [0],
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
            strokeWidth: 2
          }]
        };
      }

      return {
        labels: data.map(d => {
          try {
            return new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
          } catch {
            return 'Invalid Date';
          }
        }),
        datasets: [{
          data: data.map(d => {
            let value = 0;
            switch (selectedMetric) {
              case 'distance': value = d.totalDistance; break;
              case 'hours': value = d.totalHours; break;
              case 'speed': value = d.averageSpeed; break;
              case 'qrImpressions': value = d.qrImpressions; break;
              default: value = d.totalDistance; break;
            }
            return sanitizeChartValue(value);
          }),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          strokeWidth: 2
        }]
      };
    } else {
      const data = analytics.monthlyTrends;
      
      // Ensure we have at least some data points
      if (data.length === 0) {
        return {
          labels: ['No Data'],
          datasets: [{
            data: [0],
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
            strokeWidth: 2
          }]
        };
      }

      return {
        labels: data.map(m => {
          try {
            return new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' });
          } catch {
            return 'Invalid Month';
          }
        }),
        datasets: [{
          data: data.map(m => {
            let value = 0;
            switch (selectedMetric) {
              case 'distance': value = m.distance; break;
              case 'hours': value = m.hours; break;
              case 'speed': value = m.compliance; break; // Using compliance as proxy for speed in monthly
              case 'qrImpressions': value = 0; break; // QR impressions not available in monthly trends yet
              default: value = m.distance; break;
            }
            return sanitizeChartValue(value);
          }),
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green
          strokeWidth: 2
        }]
      };
    }
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'distance': return 'Distance (km)';
      case 'hours': return 'Hours';
      case 'speed': return 'Speed (km/h)';
      case 'qrImpressions': return 'QR Impressions';
      default: return 'Distance (km)';
    }
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load analytics</Text>
      </View>
    );
  }

  const chartData = getChartData();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Analytics</Text>
        <Text style={styles.headerSubtitle}>Welcome back, {user?.firstName || 'Driver'}</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: analytics.isOnline ? '#22c55e' : '#ef4444' }]} />
          <Text style={styles.statusText}>
            {analytics.isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      {/* Driver Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="car" size={24} color="#3b82f6" />
            <Text style={styles.infoLabel}>Vehicle</Text>
            <Text style={styles.infoValue}>{analytics.vehiclePlateNumber}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="speedometer" size={24} color="#3b82f6" />
            <Text style={styles.infoLabel}>Avg Speed</Text>
            <Text style={styles.infoValue}>{analytics.averageSpeed} km/h</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="map" size={24} color="#3b82f6" />
            <Text style={styles.infoLabel}>Routes</Text>
            <Text style={styles.infoValue}>{analytics.totalRoutes}</Text>
          </View>
        </View>
        
        {/* Device Info Section */}
        <View style={styles.deviceInfoSection}>
          <View style={styles.deviceInfoItem}>
            <View style={styles.deviceInfoHeader}>
              <Ionicons name="tablet-portrait" size={20} color="#3b82f6" />
              <Text style={styles.deviceInfoLabel}>Device ID</Text>
            </View>
            <Text style={styles.deviceInfoValue} numberOfLines={1} ellipsizeMode="middle">
              {analytics.deviceId}
            </Text>
          </View>
          
          <View style={styles.deviceInfoRow}>
            <View style={styles.deviceInfoItem}>
              <View style={styles.deviceInfoHeader}>
                <Ionicons name="tv" size={20} color="#3b82f6" />
                <Text style={styles.deviceInfoLabel}>Screen Type</Text>
              </View>
              <Text style={styles.deviceInfoValue} numberOfLines={1}>
                {analytics.screenType}
              </Text>
            </View>
            
            <View style={styles.deviceInfoItem}>
              <View style={styles.deviceInfoHeader}>
                <Ionicons name="cube" size={20} color="#3b82f6" />
                <Text style={styles.deviceInfoLabel}>Material ID</Text>
              </View>
              <Text style={styles.deviceInfoValue} numberOfLines={1} ellipsizeMode="middle">
                {analytics.materialId}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Performance Metrics */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Distance Today</Text>
          <Text style={styles.metricValue}>{analytics.totalDistance.toFixed(2)} km</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Hours Today</Text>
          <Text style={styles.metricValue}>{analytics.totalHours.toFixed(1)}h</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Hours Remaining</Text>
          <Text style={styles.metricValue}>{analytics.hoursRemaining.toFixed(1)}h</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>QR Impressions</Text>
          <Text style={styles.metricValue}>{analytics.qrImpressions}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Km Distance</Text>
          <Text style={styles.metricValue}>{analytics.totalDistance.toFixed(1)} km</Text>
        </View>
      </View>



      {/* Chart Controls */}
      <View style={styles.chartControls}>
        <View style={styles.periodSelector}>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'daily' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('daily')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'daily' && styles.periodButtonTextActive]}>
              Daily
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, selectedPeriod === 'monthly' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('monthly')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'monthly' && styles.periodButtonTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricSelector}>
          <TouchableOpacity
            style={[styles.metricButton, selectedMetric === 'distance' && styles.metricButtonActive]}
            onPress={() => setSelectedMetric('distance')}
          >
            <Text style={[styles.metricButtonText, selectedMetric === 'distance' && styles.metricButtonTextActive]}>
              Distance
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.metricButton, selectedMetric === 'hours' && styles.metricButtonActive]}
            onPress={() => setSelectedMetric('hours')}
          >
            <Text style={[styles.metricButtonText, selectedMetric === 'hours' && styles.metricButtonTextActive]}>
              Hours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.metricButton, selectedMetric === 'speed' && styles.metricButtonActive]}
            onPress={() => setSelectedMetric('speed')}
          >
            <Text style={[styles.metricButtonText, selectedMetric === 'speed' && styles.metricButtonTextActive]}>
              Speed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.metricButton, selectedMetric === 'qrImpressions' && styles.metricButtonActive]}
            onPress={() => setSelectedMetric('qrImpressions')}
          >
            <Text style={[styles.metricButtonText, selectedMetric === 'qrImpressions' && styles.metricButtonTextActive]}>
              QR Impressions
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart */}
      {chartData && chartData.datasets && chartData.datasets.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>
            {selectedPeriod === 'daily' ? 'Daily' : 'Monthly'} {getMetricLabel()}
          </Text>
          <LineChart
            data={chartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: '#3b82f6'
              }
            }}
            bezier
            style={styles.chart}
          />
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
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ef4444',
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  infoCard: {
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  // Device Info Section Styles
  deviceInfoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  deviceInfoItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  deviceInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceInfoLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  deviceInfoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textAlign: 'center',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  chartControls: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  periodButtonTextActive: {
    color: '#3b82f6',
  },
  metricSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  metricButtonActive: {
    backgroundColor: '#3b82f6',
  },
  metricButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  metricButtonTextActive: {
    color: '#ffffff',
  },
  chartContainer: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default Dashboard;
