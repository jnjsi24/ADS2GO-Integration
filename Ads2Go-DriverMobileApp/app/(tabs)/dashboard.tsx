import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, Platform } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import { LinearGradient } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  dailyData?: {
    period: string;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    aggregatedMetrics: {
      totalDistance: number;
      totalHours: number;
      totalQRImpressions: number;
      totalAdImpressions: number;
      totalAdPlayTime: number;
      totalAdPlays: number;
    };
    dailyBreakdown: Array<{
      date: string;
      totalDistance: number;
      totalHours: number;
      totalQRImpressions: number;
      totalAdImpressions: number;
      totalAdPlayTime: number;
      totalAdPlays: number;
      isDisplaying: boolean;
      maintenanceMode: boolean;
      hourlyStats: any[];
      adPerformance: any[];
      qrScansByAd: any[];
    }>;
    totalDays: number;
    message?: string;
  } | null;
  monthlyData?: {
    period: string;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    aggregatedMetrics: {
      totalDistance: number;
      totalHours: number;
      totalQRImpressions: number;
      totalAdImpressions: number;
      totalAdPlayTime: number;
      totalAdPlays: number;
    };
    monthlyBreakdown: Array<{
      month: string;
      monthKey: string;
      totalDistance: number;
      totalHours: number;
      totalQRImpressions: number;
      totalAdImpressions: number;
      totalAdPlayTime: number;
      totalAdPlays: number;
      totalDays: number;
      averageSpeed: number;
      compliance: number;
    }>;
    totalMonths: number;
    message?: string;
  } | null;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'distance' | 'hours' | 'qrImpressions'>('distance');
  const [selectedDataPoint, setSelectedDataPoint] = useState<{value: number, label: string, index: number} | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dataCache, setDataCache] = useState<{[key: string]: {data: DriverAnalytics, timestamp: number}}>({});


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
    
    // Auto-refresh only for current date (realtime data) every 60 seconds
    const refreshInterval = setInterval(async () => {
      const isToday = isSelectedDateToday();
      if (isToday) {
        const driverInfo = await AsyncStorage.getItem('driverInfo');
        if (driverInfo) {
          const driver = JSON.parse(driverInfo);
          const driverId = driver.driverId || driver.id;
          if (driverId) {
            // Silent refresh - no console logs
            await fetchDriverAnalytics(driverId, true);
          }
        }
      }
    }, 60000); // Increased to 60 seconds
    
    return () => clearInterval(refreshInterval);
  }, [selectedDate]); // Only re-create interval when date changes

  // Refetch data when selectedDate changes
  useEffect(() => {
    if (user?.driverId || user?.id) {
      const driverId = user.driverId || user.id;
      fetchDriverAnalytics(driverId);
    }
    // Reset selected data point when date changes
    setSelectedDataPoint(null);
  }, [selectedDate]);

  // Reset selected data point when metric changes
  useEffect(() => {
    setSelectedDataPoint(null);
  }, [selectedMetric]);

  // Helper function to check if selected date is today
  const isSelectedDateToday = () => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  const fetchDriverAnalytics = async (driverId: string, silent: boolean = false) => {
    try {
      // Set refreshing state for silent updates
      if (silent) {
        setRefreshing(true);
      }

      // Check cache first (5 minutes for today, 15 minutes for past dates)
      const dateKey = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const cacheKey = `${driverId}-${dateKey}`;
      const isToday = isSelectedDateToday();
      const cacheExpiry = isToday ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5 or 15 minutes
      const cachedData = dataCache[cacheKey];
      
      if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry && !silent) {
        if (!silent) {
          console.log('📦 Using cached data for', dateKey);
        }
        setAnalytics(cachedData.data);
        setLoading(false);
        return;
      }
      
      // Get auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }
      if (!silent) {
        console.log('✅ Auth token found');
      }

      // Build API URL based on selected date
      // If today: Use 'realtime' to get today's data from DeviceTracking (devicetrackings collection)
      // If past date: Use 'daily' with specific date from DeviceDataHistoryV2
      let apiUrl = '';
      if (isToday) {
        apiUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}?period=realtime`;
      } else {
        // Past date: Fetch specific date from DeviceDataHistoryV2
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        apiUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}?period=daily&startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`;
      }
      
      if (!silent) {
        console.log('🌐 API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
        console.log('🌐 Fetching from URL:', apiUrl);
        console.log('📊 Selected date:', dateKey);
        console.log('📊 Is today:', isToday);
      }
      
      const dailyResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!dailyResponse.ok) {
        // Handle 404 gracefully - device may have been unregistered
        if (dailyResponse.status === 404) {
          if (!silent) {
            console.log('ℹ️ No device tracking found - device may not be registered yet or was unregistered');
          }
          setAnalytics(null);
          setLoading(false);
          return;
        }
        
        // For other errors, log but don't crash
        if (!silent) {
          console.warn(`⚠️ Analytics endpoint returned status: ${dailyResponse.status}`);
        }
        setAnalytics(null);
        setLoading(false);
        return;
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
          // Daily view: Today's data from DeviceTracking (devicetrackings collection)
          // Monthly view: Last 30 days aggregated from DeviceDataHistoryV2
          totalDistance: data.dailyData?.aggregatedMetrics?.totalDistance || 
                        sanitizeNumeric(data.totalDistanceToday, 0),
          totalHours: data.dailyData?.aggregatedMetrics?.totalHours || 
                     sanitizeNumeric(data.currentHours, 0),
          hoursRemaining: sanitizeNumeric(data.hoursRemaining, 0),
          averageSpeed: sanitizeNumeric(data.averageSpeed, 0),
          maxSpeed: sanitizeNumeric(data.maxSpeed, 0),
          qrImpressions: data.dailyData?.aggregatedMetrics?.totalQRImpressions || 
                        sanitizeNumeric(data.qrImpressions || data.totalQrScans || 0, 0),
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
          monthlyTrends: data.monthlyTrends || [], // Will be populated from monthly data
          // Add daily data if available
          dailyData: data.dailyData ? {
            period: data.dailyData.period,
            dateRange: data.dailyData.dateRange,
            aggregatedMetrics: data.dailyData.aggregatedMetrics,
            dailyBreakdown: data.dailyData.dailyBreakdown || [],
            totalDays: data.dailyData.totalDays || 0,
            message: data.dailyData.message
          } : null,
          // Add monthly data if available
          monthlyData: data.monthlyData ? {
            period: data.monthlyData.period,
            dateRange: data.monthlyData.dateRange,
            aggregatedMetrics: data.monthlyData.aggregatedMetrics,
            monthlyBreakdown: data.monthlyData.monthlyBreakdown || [],
            totalMonths: data.monthlyData.totalMonths || 0,
            message: data.monthlyData.message
          } : null
        };
        
        setAnalytics(transformedAnalytics);
        
        // Cache the data
        const dateKey = selectedDate.toISOString().split('T')[0];
        const cacheKey = `${driverId}-${dateKey}`;
        setDataCache(prev => ({
          ...prev,
          [cacheKey]: {
            data: transformedAnalytics,
            timestamp: Date.now()
          }
        }));
      } else {
        throw new Error(screenTrackingData.message || 'Failed to fetch analytics');
      }
    } catch (error) {
      console.log('ℹ️ Could not fetch driver analytics - this is normal if device is not registered');
      setAnalytics(null);
      // Don't show alert - this is expected behavior when device is unregistered
    } finally {
      if (silent) {
        setRefreshing(false);
      }
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

    const isToday = isSelectedDateToday();

    if (isToday) {
      // For today, show last 7 days trend from DeviceTracking's dailyPerformance
      const data = analytics.dailyPerformance.slice(-7);
      
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
              case 'qrImpressions': value = d.qrImpressions || 0; break;
              default: value = d.totalDistance; break;
            }
            return sanitizeChartValue(value);
          }),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          strokeWidth: 2
        }]
      };
    } else {
      // Past date: Show data for selected date from DeviceDataHistoryV2
      const data = analytics.dailyData?.dailyBreakdown || [];
      
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

      // Take the selected date data and format labels
      return {
        labels: data.map(d => {
          try {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } catch {
            return 'Invalid Date';
          }
        }),
        datasets: [{
          data: data.map(d => {
            let value = 0;
            switch (selectedMetric) {
              case 'distance': value = d.totalDistance || 0; break;
              case 'hours': value = d.totalHours || 0; break;
              case 'qrImpressions': value = d.totalQRImpressions || 0; break;
              default: value = d.totalDistance || 0; break;
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
      case 'qrImpressions': return 'QR Scans';
      default: return 'Distance (km)';
    }
  };

  const handleDataPointClick = (data: any) => {
    // Extract value and index from the clicked data point
    const { value, index, dataset } = data;
    const chartData = getChartData();
    
    if (chartData && chartData.labels && chartData.labels[index]) {
      setSelectedDataPoint({
        value: value,
        label: chartData.labels[index],
        index: index
      });
    }
  };

  const getCurrentMetricValue = () => {
    if (!analytics) return 0;

    // If a data point is selected, return its value
    if (selectedDataPoint) {
      return selectedDataPoint.value;
    }

    let value = 0;
    const isToday = isSelectedDateToday();
    
    if (isToday) {
      // Use today's real-time data from DeviceTracking (devicetrackings)
      switch (selectedMetric) {
        case 'distance': value = analytics.totalDistance || 0; break;
        case 'hours': value = analytics.totalHours || 0; break;
        case 'qrImpressions': value = analytics.qrImpressions || 0; break;
        default: value = analytics.totalDistance || 0; break;
      }
    } else {
      // Use selected date aggregated data from DeviceDataHistoryV2
      const dailyData = analytics.dailyData?.aggregatedMetrics;
      switch (selectedMetric) {
        case 'distance': value = dailyData?.totalDistance || 0; break;
        case 'hours': value = dailyData?.totalHours || 0; break;
        case 'qrImpressions': value = dailyData?.totalQRImpressions || 0; break;
        default: value = dailyData?.totalDistance || 0; break;
      }
    }
    
    return sanitizeChartValue(value);
  };

  const getMetricShortLabel = () => {
    switch (selectedMetric) {
      case 'distance': return 'Distance';
      case 'hours': return 'Hours';
      case 'qrImpressions': return 'QR Scans';
      default: return 'Distance';
    }
  };

  const getMetricUnit = () => {
    switch (selectedMetric) {
      case 'distance': return 'km';
      case 'hours': return 'hrs';
      case 'qrImpressions': return 'scans';
      default: return 'km';
    }
  };

  // Memoize chart data to avoid recalculating on every render
  // Must be called before any early returns (Rules of Hooks)
  const chartData = useMemo(() => {
    if (!analytics) return null;
    return getChartData();
  }, [analytics, selectedDate, selectedMetric]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#3674B5" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
          <View style={styles.loadingDotsContainer}>
            <View style={[styles.loadingDot, styles.loadingDot1]} />
            <View style={[styles.loadingDot, styles.loadingDot2]} />
            <View style={[styles.loadingDot, styles.loadingDot3]} />
          </View>
        </View>
      </View>
    );
  }

  if (!analytics) {
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
    <View style={styles.mainContainer}>
      {/* Loading Overlay for Refreshing */}
      {refreshing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingOverlayContent}>
            <ActivityIndicator size="large" color="#3674B5" />
            <Text style={styles.loadingOverlayText}>Updating data...</Text>
          </View>
        </View>
      )}
      
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Profile Image */}
          <View style={styles.profileContainer}>
            <Ionicons name="person-circle" size={60} color="#3674B5" />
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <Text style={styles.headerSubtitle}>
              Welcome back, {user?.firstName || 'Driver'}
            </Text>
          </View>

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




      {/* Chart Controls */}
      <View style={styles.chartControls}>
        <View style={styles.datePickerContainer}>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#3674B5" style={styles.dateIcon} />
            <Text style={styles.datePickerText}>
              {selectedDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Text>
            <Ionicons name="chevron-down-outline" size={20} color="#6b7280" />
          </TouchableOpacity>
          {isSelectedDateToday() && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event: any, date?: Date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) {
                setSelectedDate(date);
              }
            }}
            maximumDate={new Date()}
          />
        )}

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
            style={[styles.metricButton, selectedMetric === 'qrImpressions' && styles.metricButtonActive]}
            onPress={() => setSelectedMetric('qrImpressions')}
          >
            <Text style={[styles.metricButtonText, selectedMetric === 'qrImpressions' && styles.metricButtonTextActive]}>
              QR Scans
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Numerical Value Display */}
      <View style={styles.metricValueContainer}>
        <View style={styles.metricValueCard}>
          <Text style={styles.metricValueLabel}>{getMetricShortLabel()}</Text>
          <View style={styles.metricValueRow}>
            <Text style={styles.metricValueNumber}>
              {getCurrentMetricValue().toFixed(selectedMetric === 'distance' ? 1 : 0)}
            </Text>
            {getMetricUnit() && (
              <Text style={styles.metricValueUnit}> {getMetricUnit()}</Text>
            )}
          </View>
          <Text style={styles.metricValuePeriod}>
            {selectedDataPoint 
              ? `${selectedDataPoint.label}` 
              : selectedDate.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
          </Text>
          {selectedDataPoint && !isSelectedDateToday() && (
            <TouchableOpacity 
              onPress={() => setSelectedDataPoint(null)}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>View Total</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chart */}
      {chartData && chartData.datasets && chartData.datasets.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>
            {isSelectedDateToday() ? 'Last 7 Days' : selectedDate.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })} {getMetricLabel()}
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
            onDataPointClick={handleDataPointClick}
          />
        </View>
      )}


        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#3674B5',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3674B5',
  },
  loadingDot1: {
    opacity: 0.3,
  },
  loadingDot2: {
    opacity: 0.6,
  },
  loadingDot3: {
    opacity: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingOverlayContent: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingOverlayText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#3674B5',
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
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  dateIcon: {
    marginRight: 4,
  },
  todayBadge: {
    backgroundColor: '#3674B5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  metricSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricButtonActive: {
    backgroundColor: '#3674B5',
  },
  metricButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  metricButtonTextActive: {
    color: '#ffffff',
  },
  // Numerical Value Display
  metricValueContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  metricValueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#3674B5',
  },
  metricValueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  metricValueNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#3674B5',
  },
  metricValueUnit: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 4,
  },
  metricValuePeriod: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
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
  resetButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#3674B5',
    borderRadius: 8,
    alignSelf: 'center',
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default Dashboard;
