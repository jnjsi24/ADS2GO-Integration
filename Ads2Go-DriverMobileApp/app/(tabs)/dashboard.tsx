import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import { LinearGradient } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');


interface DriverAnalytics {
  driverId: string;
  vehiclePlateNumber: string;
  vehicleModel: string;
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
  complianceRate: number;
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
          vehicleModel: data.vehicleModel || 'Unknown',
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
          complianceRate: sanitizeNumeric(data.complianceRate, 0),
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
        <ActivityIndicator size="large" color="#3674B5" />
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
        <View style={styles.headerContent}>
          {/* Profile Image */}
          <View style={styles.profileContainer}>
            <Ionicons name="person-circle" size={60} color="#3674B5" />
          </View>

          {/* Text and Status */}
          <View style={styles.textContainer}>
            <Text style={styles.headerSubtitle}>
              Welcome back, {user?.firstName || 'Driver'}
            </Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: analytics.isOnline ? '#22c55e' : '#ef4444' },
                ]}
              />
              <Text style={styles.statusText}>
                {analytics.isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          {/* 🔔 Bell Icon */}
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Ionicons
              name="notifications-outline"
              size={28}
              color="#374151"
              style={styles.bellIcon}
            />
          </TouchableOpacity>
        </View>
      </View>


      {/* Balance Container */}
      <View style={styles.cardContainer}>
        <View style={styles.cardHeader}>
          <Text style={styles.balanceLabel}>Payout Balance</Text>
        </View>
        <Text style={styles.balanceCurrency}>PHP</Text>
        <Text style={styles.balanceAmount}>2,450.00</Text>
      </View>


      {/* Vehicle */}
      <View style={styles.infoCard}>
        {/* --- Top Row: Icon + Route + Vehicle Plate --- */}
        <View style={styles.vehicleTopRow}>
          <View style={styles.vehicleLeft}>
            <Ionicons name="car" size={26} color="#3674B5" style={{ marginRight: 8 }} />
            <Text style={styles.routeText}>
              {analytics.totalRoutes} Route{analytics.totalRoutes > 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.vehicleRight}>
            <Text style={styles.vehiclePlate}>{analytics.vehiclePlateNumber}</Text>
          </View>
        </View>

        {/* --- Second Line: Vehicle Model --- */}
        <Text style={styles.vehicleModel}>{analytics.vehicleModel}</Text>

        {/* --- Divider --- */}
        <View style={styles.divider} />

        {/* --- Device Info Section --- */}
        <View style={styles.deviceInfoSection}>
          <View style={styles.deviceInfoRow}>
            <View style={styles.deviceInfoItem}>
              <Ionicons name="tablet-portrait" size={20} color="#3674B5" />
              <Text style={styles.deviceInfoValue}>{analytics.deviceId}</Text>
            </View>

            <View style={styles.deviceInfoItem}>
              <Ionicons name="tv" size={20} color="#3674B5" />
              <Text style={styles.deviceInfoValue}>{analytics.screenType}</Text>
            </View>

            <View style={styles.deviceInfoItem}>
              <Ionicons name="cube" size={20} color="#3674B5" />
              <Text
                style={styles.deviceInfoValue}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {analytics.materialId}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* --- Ad Campaign Card --- */}
      <View style={styles.adCard}>
        {/* Header Section */}
        <View style={styles.metricsHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.adTitle}>Ad Campaign</Text>
              <View style={styles.periodTag}>
                <Text style={styles.periodText}>30 Days</Text>
              </View>
            </View>

            <Text style={styles.companyInfo}>
              Sample Company <Text style={styles.adId}>#AdID3264</Text>
            </Text>

          </View>
        </View>

        {/* QR and Distance Row */}
        <View style={styles.qrDistanceRow}>
          <Ionicons name="qr-code" size={22} color="#3674B5" style={{ marginRight: 6 }} />
          <Text style={styles.qrValue}>{analytics.qrImpressions}</Text>
          <Text style={styles.verticalDivider}>|</Text>
          <Text style={styles.distanceValue}>
            {analytics.totalDistance.toFixed(2)} km Today
          </Text>
        </View>
        
        <View style={styles.divider} />

        {/* Location Card: EDSA */}
        <View style={styles.routeRow}>
          <View style={styles.iconLineContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="location" size={16} color="#ffffff" />
            </View>
            <View style={styles.dashedLineFull} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.locationName}>EDSA Street</Text>
            <Text style={styles.locationSubText}>
              {analytics.hoursRemaining.toFixed(1)} hours remaining • 11:59 PM
            </Text>
          </View>
        </View>

        {/* Distance + Hours Pill */}
        <View style={styles.routeRow}>
          <View style={styles.iconLineContainer}>
            <View style={styles.dashedLineFull} />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.locationPill}>
              <Text style={styles.locationPillText}>
                {analytics.totalDistance.toFixed(2)} km - {analytics.totalHours.toFixed(1)} hours
              </Text>
            </View>
          </View>
        </View>

        {/* Kalayaan Section */}
        <View style={styles.routeRow}>
          <View style={styles.iconLineContainer}>
            <View style={styles.iconCircle2}>
              <Ionicons name="locate" size={16} color="#ffffff" />
            </View>
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.locationName}>Kalayaan Street</Text>
            <Text style={styles.locationSubText}>
              {analytics.hoursRemaining.toFixed(1)} hours remaining • 11:59 PM
            </Text>
          </View>
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
                stroke: '#3674B5'
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

  // Header
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileContainer: {
    marginRight: 12,
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },

  bellIcon: {
    marginLeft: 10,
  },

  // Balance Container
  cardContainer: {
    backgroundColor: '#3674B5', // elegant blue tone
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  balanceLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
  
  cardLogo: {
    width: 40,
    height: 30,
    resizeMode: 'contain',
  },
  
  balanceCurrency: {
    color: '#E5E7EB',
    fontSize: 12,
    marginTop: 10,
  },
  
  balanceAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  
  cardNumber: {
    color: '#E5E7EB',
    letterSpacing: 3,
    fontSize: 16,
    marginVertical: 10,
  },
  
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  
  cardHolder: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  expLabel: {
    color: '#E5E7EB',
    fontSize: 12,
    textAlign: 'right',
  },
  
  expValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  

  
  // Section 2
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  
  vehicleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  vehicleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  vehicleRight: {
    alignItems: 'flex-end',
  },
  
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  
  vehiclePlate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  
  vehicleModel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'right'
  },
  
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },

  deviceInfoSection: {
    marginTop: 1,
  },
  
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start', 
    alignItems: 'center',
    gap: 12, 
  },
  
  deviceInfoItem: {
    flexDirection: 'row', 
    alignItems: 'center',
  },
  
  deviceInfoHeader: {
    marginRight: 10, 
  },
  
  deviceInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    maxWidth: 110,
    marginLeft: 6, 
  },
  
  


  // Metrics Container Styles
  adCard: {
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
  
  metricsHeader: {
    marginBottom: 12,
  },
  
  headerLeft: {
    flexDirection: 'column',
  },
  
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  adTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  
  periodTag: {
    backgroundColor: '#22c55e',
    borderRadius: 9999, // fully rounded
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 8,
  },
  
  periodText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  adId: {
    color: '#22c55e',
    fontWeight: '700',
  },
  companyInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  
  qrDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start', // keep everything inline on the left
    marginBottom: 12,
  },
  
  qrValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  
  verticalDivider: {
    fontSize: 16,
    color: '#9ca3af', // light gray divider
    marginHorizontal: 8,
  },
  
  distanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  
  routeContainer: {
    flexDirection: 'column',
    marginTop: 10,
  },
  
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  
  iconLineContainer: {
    alignItems: 'center',
    width: 30,
  },
  
  dashedLineFull: {
    width: 2,
    flex: 1,
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderColor: '#9ca3af',
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  
  textContainer: {
    flex: 1,
    paddingBottom: 8,
  },
  
  locationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
  },
  
  locationSubText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    marginLeft: 10,
  },
  
  locationPill: {
    backgroundColor: '#e5e7eb',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 40,
    alignSelf: 'flex-start',
    marginVertical: 6,
  },
  
  locationPillText: {
    color: '#3674B5',
    fontWeight: '700',
    fontSize: 14,
  },

  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3674B5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },

  iconCircle2: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  
  

  // Chart Controls
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
    color: '#3674B5',
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
    gap: 10,
  },
  metricButtonActive: {
    backgroundColor: '#3674B5',
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
