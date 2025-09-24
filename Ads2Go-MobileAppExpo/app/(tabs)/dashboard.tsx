import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';

const { width: screenWidth } = Dimensions.get('window');

interface SpeedViolation {
  type: 'SPEED_VIOLATION';
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  penalty: number;
  currentSpeed: number;
  speedLimit: number;
  speedOverLimit: number;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  isResolved: boolean;
  resolvedAt?: string;
}

interface DriverAnalytics {
  driverId: string;
  vehiclePlateNumber: string;
  vehicleType: string;
  totalDistance: number;
  totalHours: number;
  averageSpeed: number;
  maxSpeed: number;
  speedViolations: number;
  safetyScore: number;
  complianceRate: number;
  totalRoutes: number;
  isOnline: boolean;
  violations: SpeedViolation[];
  violationStats: {
    total: number;
    today: number;
    byLevel: {
      low: number;
      medium: number;
      high: number;
      extreme: number;
    };
    averageSpeedOverLimit: number;
  };
  dailyPerformance: Array<{
    date: string;
    totalDistance: number;
    totalHours: number;
    averageSpeed: number;
    maxSpeed: number;
    speedViolations: number;
    complianceScore: number;
    safetyScore: number;
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
  const [selectedMetric, setSelectedMetric] = useState<'distance' | 'hours' | 'speed' | 'compliance'>('distance');


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
        
        // Calculate violation statistics
        const violations = data.violations || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayViolations = violations.filter((v: any) => new Date(v.timestamp) >= today);
        
        const violationStats = {
          total: violations.length,
          today: todayViolations.length,
          byLevel: {
            low: violations.filter((v: any) => v.level === 'LOW').length,
            medium: violations.filter((v: any) => v.level === 'MEDIUM').length,
            high: violations.filter((v: any) => v.level === 'HIGH').length,
            extreme: violations.filter((v: any) => v.level === 'EXTREME').length
          },
          averageSpeedOverLimit: violations.length > 0 
            ? violations.reduce((sum: number, v: any) => sum + v.speedOverLimit, 0) / violations.length 
            : 0
        };

        // Transform ScreenTracking data to match our interface
        const transformedAnalytics: DriverAnalytics = {
          driverId: data.driverId,
          vehiclePlateNumber: data.vehiclePlateNumber,
          vehicleType: data.vehicleType,
          totalDistance: data.totalDistanceToday || 0,
          totalHours: data.currentHours || 0,
          averageSpeed: data.averageSpeed || 0,
          maxSpeed: data.maxSpeed || 0,
          speedViolations: violationStats.total,
          safetyScore: data.safetyScore || 0,
          complianceRate: data.complianceRate || 0,
          totalRoutes: 1, // Single route for current session
          isOnline: data.isOnline || false,
          violations: violations,
          violationStats: violationStats,
          dailyPerformance: data.dailyPerformance || [],
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

  const getChartData = () => {
    if (!analytics) return null;

    if (selectedPeriod === 'daily') {
      const data = analytics.dailyPerformance.slice(-7); // Last 7 days
      return {
        labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })),
        datasets: [{
          data: data.map(d => {
            switch (selectedMetric) {
              case 'distance': return d.totalDistance;
              case 'hours': return d.totalHours;
              case 'speed': return d.averageSpeed;
              case 'compliance': return d.complianceScore;
              default: return d.totalDistance;
            }
          }),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          strokeWidth: 2
        }]
      };
    } else {
      const data = analytics.monthlyTrends;
      return {
        labels: data.map(m => new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' })),
        datasets: [{
          data: data.map(m => {
            switch (selectedMetric) {
              case 'distance': return m.distance;
              case 'hours': return m.hours;
              case 'speed': return m.compliance; // Using compliance as proxy for speed in monthly
              case 'compliance': return m.compliance;
              default: return m.distance;
            }
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
      case 'compliance': return 'Compliance (%)';
      default: return 'Distance (km)';
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 90) return '#22c55e'; // Green
    if (score >= 70) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return '#22c55e'; // Green
    if (rate >= 70) return '#eab308'; // Yellow
    return '#ef4444'; // Red
  };

  const getViolationColor = (level: string) => {
    switch (level) {
      case 'LOW': return '#22c55e'; // Green
      case 'MEDIUM': return '#f59e0b'; // Orange
      case 'HIGH': return '#ef4444'; // Red
      case 'EXTREME': return '#dc2626'; // Dark Red
      default: return '#6b7280'; // Gray
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
          <Text style={styles.metricLabel}>Safety Score</Text>
          <Text style={[styles.metricValue, { color: getSafetyColor(analytics.safetyScore) }]}>
            {analytics.safetyScore}/100
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Compliance</Text>
          <Text style={[styles.metricValue, { color: getComplianceColor(analytics.complianceRate) }]}>
            {analytics.complianceRate}%
          </Text>
        </View>
      </View>

      {/* Violations Section */}
      <View style={styles.violationsSection}>
        <Text style={styles.sectionTitle}>Speed Violations</Text>
        <View style={styles.violationsGrid}>
          <View style={styles.violationCard}>
            <Ionicons name="warning-outline" size={20} color="#ef4444" />
            <Text style={styles.violationLabel}>Total</Text>
            <Text style={styles.violationValue}>{analytics.violationStats.total}</Text>
          </View>
          <View style={styles.violationCard}>
            <Ionicons name="today-outline" size={20} color="#f59e0b" />
            <Text style={styles.violationLabel}>Today</Text>
            <Text style={styles.violationValue}>{analytics.violationStats.today}</Text>
          </View>
          <View style={styles.violationCard}>
            <Ionicons name="speedometer-outline" size={20} color="#8b5cf6" />
            <Text style={styles.violationLabel}>Avg Over</Text>
            <Text style={styles.violationValue}>{analytics.violationStats.averageSpeedOverLimit.toFixed(1)} km/h</Text>
          </View>
        </View>
        
        {/* Violation Levels */}
        <View style={styles.violationLevels}>
          <View style={styles.violationLevel}>
            <View style={[styles.levelDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.levelText}>Low: {analytics.violationStats.byLevel.low}</Text>
          </View>
          <View style={styles.violationLevel}>
            <View style={[styles.levelDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.levelText}>Medium: {analytics.violationStats.byLevel.medium}</Text>
          </View>
          <View style={styles.violationLevel}>
            <View style={[styles.levelDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.levelText}>High: {analytics.violationStats.byLevel.high}</Text>
          </View>
          <View style={styles.violationLevel}>
            <View style={[styles.levelDot, { backgroundColor: '#dc2626' }]} />
            <Text style={styles.levelText}>Extreme: {analytics.violationStats.byLevel.extreme}</Text>
          </View>
        </View>
      </View>

      {/* Recent Violations */}
      {analytics.violations.length > 0 && (
        <View style={styles.recentViolationsSection}>
          <Text style={styles.sectionTitle}>Recent Violations</Text>
          {analytics.violations.slice(0, 3).map((violation, index) => (
            <View key={index} style={styles.violationItem}>
              <View style={styles.violationHeader}>
                <View style={[styles.violationBadge, { backgroundColor: getViolationColor(violation.level) }]}>
                  <Text style={styles.violationBadgeText}>{violation.level}</Text>
                </View>
                <Text style={styles.violationTime}>
                  {new Date(violation.timestamp).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.violationDetails}>
                {violation.currentSpeed} km/h in {violation.speedLimit} km/h zone (+{violation.speedOverLimit} km/h)
              </Text>
            </View>
          ))}
        </View>
      )}

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
            style={[styles.metricButton, selectedMetric === 'compliance' && styles.metricButtonActive]}
            onPress={() => setSelectedMetric('compliance')}
          >
            <Text style={[styles.metricButtonText, selectedMetric === 'compliance' && styles.metricButtonTextActive]}>
              Compliance
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart */}
      {chartData && (
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

      {/* Speed Violations */}
      {analytics.speedViolations > 0 && (
        <View style={styles.violationsCard}>
          <View style={styles.violationsHeader}>
            <Ionicons name="warning" size={20} color="#ef4444" />
            <Text style={styles.violationsTitle}>Speed Violations</Text>
          </View>
          <Text style={styles.violationsText}>
            You have {analytics.speedViolations} speed violation(s) this period.
            Please drive safely and within speed limits.
          </Text>
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
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginRight: '2%',
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
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  // Violations Section Styles
  violationsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  violationsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  violationCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  violationLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
  },
  violationValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  violationLevels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  violationLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '48%',
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  levelText: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Recent Violations Styles
  recentViolationsSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  violationItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  violationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  violationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  violationBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  violationTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  violationDetails: {
    fontSize: 14,
    color: '#374151',
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
  violationsCard: {
    margin: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  violationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  violationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  violationsText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default Dashboard;
