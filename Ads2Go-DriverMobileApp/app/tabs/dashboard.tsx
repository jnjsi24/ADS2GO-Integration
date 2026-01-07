import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, Platform, Modal, Image } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
import { LinearGradient, Circle } from 'react-native-svg';
import Svg from 'react-native-svg';
import { router } from 'expo-router';

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
  last7DaysData?: {
    period: string;
    dateRange: {
      startDate: string;
      endDate: string;
    };
    dailyBreakdown: Array<{
      date: string;
      totalDistance: number;
      totalHours: number;
      totalQRImpressions: number;
      totalAdImpressions: number;
      totalAdPlayTime: number;
      totalAdPlays: number;
    }>;
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
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [materialMountedAt, setMaterialMountedAt] = useState<string | null>(null); // ✅ Track mounted date (when material was physically installed)


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
          
          // Fetch real analytics data and salary summary
          await Promise.all([
            fetchDriverAnalytics(driverId),
            fetchSalarySummary()
          ]);
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
  // ✅ Auto-select today's data point for distance tab (like hours tab does automatically)
  // This ensures distance shows today's value automatically when today is selected
  useEffect(() => {
    // Reset selected data point first
    setSelectedDataPoint(null);
    
    // Auto-select today's data point (last point in chart) when:
    // 1. Metric is 'distance' and today is selected
    // 2. Analytics data is available
    if (selectedMetric === 'distance' && analytics) {
      const isToday = isSelectedDateToday();
      
      if (isToday) {
        // Get last 7 days data from analytics
        const last7Days = analytics.last7DaysData?.dailyBreakdown || [];
        
        if (last7Days.length > 0) {
          // Sort by date and get the last data point (today's data)
          const sortedData = [...last7Days].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          
          if (sortedData.length > 0) {
            const lastDataPoint = sortedData[sortedData.length - 1];
            // Use sanitizeChartValue logic inline to avoid dependency issues
            const rawValue = lastDataPoint.totalDistance || 0;
            const lastValue = (rawValue === null || rawValue === undefined || isNaN(rawValue) || !isFinite(rawValue)) 
              ? 0 
              : Math.max(0, Number(rawValue));
            const lastLabel = (() => {
              try {
                return new Date(lastDataPoint.date).toLocaleDateString('en-US', { weekday: 'short' });
              } catch {
                return 'Today';
              }
            })();
            const lastIndex = sortedData.length - 1;
            
            if (lastValue !== undefined && lastValue !== null) {
              // Auto-select today's data point
              setSelectedDataPoint({
                value: lastValue,
                label: lastLabel,
                index: lastIndex
              });
            }
          }
        }
      }
    }
  }, [selectedMetric, analytics, selectedDate]);

  // Helper function to check if selected date is today
  const isSelectedDateToday = () => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  // Helper function to create empty analytics for dates with no data
  const createEmptyAnalytics = (driverData: any): DriverAnalytics => {
    return {
      driverId: driverData?.driverId || driverData?.id || 'Unknown',
      vehiclePlateNumber: driverData?.vehiclePlateNumber || 'Unknown',
      vehicleModel: driverData?.vehicleModel || 'Unknown',
      vehicleType: driverData?.vehicleType || 'Unknown',
      deviceId: driverData?.deviceId || 'Unknown',
      screenType: 'Unknown',
      materialId: driverData?.materialId || 'Unknown',
      totalDistance: 0,
      totalHours: 0,
      hoursRemaining: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      qrImpressions: 0,
      totalRoutes: 0,
      isOnline: false,
      complianceRate: 0,
      dailyPerformance: [],
      monthlyTrends: [],
      dailyData: null,
      monthlyData: null,
      last7DaysData: {
        period: 'last7days',
        dateRange: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        },
        dailyBreakdown: Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return {
            date: date.toISOString(),
            totalDistance: 0,
            totalHours: 0,
            totalQRImpressions: 0,
            totalAdImpressions: 0,
            totalAdPlayTime: 0,
            totalAdPlays: 0
          };
        }).reverse()
      }
    };
  };

  const fetchSalarySummary = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('No auth token found for salary summary');
        return;
      }

      // Fetch salary calculations to calculate current month's salary (matching salary screen logic)
      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `
            query GetMySalaryCalculations {
              getMySalaryCalculations {
                success
                message
                calculations {
                  id
                  calculationPeriod {
                    startDate
                    endDate
                    periodType
                  }
                  calculations {
                    totalSalary
                  }
                }
              }
            }
          `,
        }),
      });

      const data = await response.json();
      
      if (data.data?.getMySalaryCalculations?.success && data.data.getMySalaryCalculations.calculations) {
        const calculations = data.data.getMySalaryCalculations.calculations;
        
        if (calculations.length === 0) {
          console.log('📊 No salary calculations found');
          setTotalEarnings(0);
          return;
        }
        
        // Calculate current month's salary - only include calculations that start in the current month
        // Use UTC to avoid timezone issues
        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth(); // 0-indexed (0 = January, 11 = December)

        console.log('📅 Current month (UTC):', {
          month: currentMonth + 1,
          year: currentYear
        });

        const currentMonthCalculations = calculations.filter((calc: any) => {
          if (!calc.calculationPeriod?.startDate) {
            console.log('⚠️ Calculation missing startDate:', calc.id);
            return false;
          }
          
          // Parse date - handle both ISO strings and timestamps
          let startDate: Date;
          const startDateValue = calc.calculationPeriod.startDate;
          
          try {
            if (typeof startDateValue === 'string') {
              // Check if it's a numeric string (timestamp)
              if (/^\d+$/.test(startDateValue)) {
                startDate = new Date(parseInt(startDateValue, 10));
              } else {
                startDate = new Date(startDateValue);
              }
            } else if (typeof startDateValue === 'number') {
              startDate = new Date(startDateValue);
            } else {
              startDate = new Date(startDateValue);
            }
            
            // Validate date
            if (isNaN(startDate.getTime())) {
              console.warn('⚠️ Invalid date for calculation:', calc.id, startDateValue);
              return false;
            }
            
            // Use UTC month and year for comparison to avoid timezone issues
            const calcMonth = startDate.getUTCMonth();
            const calcYear = startDate.getUTCFullYear();
            const salary = calc.calculations?.totalSalary || 0;
            
            // Check if the calculation's startDate is in the current month (using UTC)
            const isInCurrentMonth = calcMonth === currentMonth && calcYear === currentYear;
            
            console.log(`📊 Calculation ${calc.id}:`, {
              startDate: startDate.toISOString(),
              calcMonth: calcMonth + 1,
              calcYear: calcYear,
              currentMonth: currentMonth + 1,
              currentYear: currentYear,
              isInCurrentMonth,
              salary: salary
            });
            
            return isInCurrentMonth;
          } catch (error) {
            console.warn('⚠️ Error parsing date for calculation:', calc.id, error);
            return false;
          }
        });

        console.log(`✅ Filtered ${currentMonthCalculations.length} calculations for current month out of ${calculations.length} total`);

        // Sum up current month calculations only
        const currentMonthSalary = currentMonthCalculations.reduce((sum: number, calc: any) => {
          const salary = calc.calculations?.totalSalary || 0;
          console.log(`💰 Adding salary: ₱${salary} from calculation ${calc.id}`);
          return sum + salary;
        }, 0);

        // Only show current month's salary (no fallback to past months)
        const finalSalary = Math.round(currentMonthSalary * 100) / 100;
        setTotalEarnings(finalSalary);
        console.log('✅ Current month salary calculated:', {
          totalSalary: finalSalary,
          calculationsCount: currentMonthCalculations.length,
          month: currentMonth + 1,
          year: currentYear
        });
      } else {
        console.warn('⚠️ getMySalaryCalculations returned success: false', data.data?.getMySalaryCalculations?.message);
        setTotalEarnings(0);
      }
    } catch (error) {
      console.error('❌ Error fetching salary summary:', error);
      // Don't show error to user, just keep default value
      setTotalEarnings(0);
    }
  };

  const fetchDriverAnalytics = async (driverId: string, silent: boolean = false) => {
    try {
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
      // Auth token validated

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
      
      // Fetching analytics data
      
      const dailyResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!dailyResponse.ok) {
        // Handle 404 gracefully
        if (dailyResponse.status === 404) {
          // If viewing today and getting 404, device is not registered
          if (isToday) {
            console.log('❌ Device not registered - no data for today');
            setAnalytics(null);
            setLoading(false);
            return;
          }
          // If viewing old date and getting 404, show empty data (no tracking data for that date)
          console.log('⚠️ No data for selected date, showing empty state');
          const emptyAnalytics = createEmptyAnalytics(user);
          setAnalytics(emptyAnalytics);
          setLoading(false);
          return;
        } else {
          // Handle other errors
          console.warn(`Analytics endpoint error: ${dailyResponse.status}`);
          if (isToday) {
            setAnalytics(null);
            setLoading(false);
            return;
          }
          // For old dates, show empty state
          const emptyAnalytics = createEmptyAnalytics(user);
          setAnalytics(emptyAnalytics);
          setLoading(false);
          return;
        }
      }

      const screenTrackingData = await dailyResponse.json();
      
      if (screenTrackingData.success) {
        const data = screenTrackingData.data;
        
        // Helper function to sanitize numeric values
        const sanitizeNumeric = (value: any, defaultValue: number = 0): number => {
          if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
            return defaultValue;
          }
          return Math.max(0, Number(value));
        };

        // Fetch last 7 days data from DeviceDataHistoryV2 for the graph
        let last7DaysData = null;
        try {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          
          const last7DaysUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${driverId}?period=daily&startDate=${sevenDaysAgo.toISOString()}&endDate=${today.toISOString()}`;
          
          // Fetching historical data
          
          const last7DaysResponse = await fetch(last7DaysUrl, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (last7DaysResponse.ok) {
            const last7DaysResult = await last7DaysResponse.json();
            if (last7DaysResult.success && last7DaysResult.data.dailyData) {
              last7DaysData = {
                period: 'last7days',
                dateRange: {
                  startDate: sevenDaysAgo.toISOString(),
                  endDate: today.toISOString()
                },
                dailyBreakdown: last7DaysResult.data.dailyData.dailyBreakdown || []
              };
              
              // Historical data loaded
            }
          }
        } catch (last7DaysError) {
          // Historical data unavailable - continue without it
        }

        // ✅ Fetch mountedAt date for date dropdown validation
        // mountedAt = when material was physically mounted on vehicle (data tracking starts from this date)
        let mountedAt = data.materialMountedAt;
        
        // If not available in screenTracking API, fetch from GraphQL
        if (!mountedAt) {
          console.log('⚠️ [Dashboard] No materialMountedAt in screenTracking API, fetching from GraphQL...');
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
                        mountedAt
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
              if (materials && materials.length > 0 && materials[0].mountedAt) {
                mountedAt = materials[0].mountedAt;
                console.log('✅ [Dashboard] Got mounted date from GraphQL:', mountedAt);
              }
            }
          } catch (error) {
            console.warn('⚠️ [Dashboard] Could not fetch mountedAt from GraphQL:', error);
          }
        }
        
        console.log('📅 [Dashboard] Final Material Mounted Date:', mountedAt);
        setMaterialMountedAt(mountedAt || null);

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
          } : null,
          // Add last 7 days data for the graph
          last7DaysData: last7DaysData
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
        // API returned success: false
        const isToday = isSelectedDateToday();
        if (isToday) {
          // For today, if no success, device not registered
          throw new Error(screenTrackingData.message || 'Failed to fetch analytics');
        }
        // For old dates, show empty state with 0 values
        console.log('⚠️ No data for selected date, creating empty analytics');
        const emptyAnalytics = createEmptyAnalytics(user);
        setAnalytics(emptyAnalytics);
        setLoading(false);
        return;
      }
    } catch (error) {
      // Analytics fetch failed
      const isToday = isSelectedDateToday();
      if (isToday) {
        // For today, this means device is not registered
        console.error('❌ Analytics fetch failed for today:', error);
        setAnalytics(null);
      } else {
        // For old dates, show empty state instead of error
        console.log('⚠️ Analytics fetch failed for old date, showing empty state');
        const emptyAnalytics = createEmptyAnalytics(user);
        setAnalytics(emptyAnalytics);
      }
    } finally {
      setLoading(false);
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

    // Always use last 7 days data from DeviceDataHistoryV2 for the graph
    const last7Days = analytics.last7DaysData?.dailyBreakdown || [];
    
    // If we have last 7 days data from DeviceDataHistoryV2, use it
    if (last7Days.length > 0) {
      // Sort by date and take last 7 days
      const sortedData = [...last7Days].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ).slice(-7);
      
      return {
        labels: sortedData.map(d => {
          try {
            return new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
          } catch {
            return 'Invalid Date';
          }
        }),
        datasets: [{
          data: sortedData.map(d => {
            let value = 0;
            switch (selectedMetric) {
              case 'distance': value = d.totalDistance || 0; break;
              case 'hours': value = d.totalHours || 0; break;
              case 'qrImpressions': value = d.totalQRImpressions || 0; break;
              default: value = d.totalDistance || 0; break;
            }
            return sanitizeChartValue(value);
          }),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          strokeWidth: 2
        }]
      };
    }
    
    // Fallback: If no last 7 days data, check if viewing a specific past date
    const isToday = isSelectedDateToday();
    
    if (!isToday) {
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
    
    // Last fallback: Use dailyPerformance from current tracking (should rarely happen)
    const data = analytics.dailyPerformance.slice(-7);
    
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
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
          <Text style={styles.loadingText}>Loading analytics</Text>
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
              {(() => {
                const getImageUrl = (src?: string | null) => {
                  if (!src) return null;
                  if (/^https?:\/\//i.test(src)) return src;
                  return `${API_CONFIG.BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
                };
                const imgUrl = getImageUrl(user?.profilePicture);
                if (imgUrl) {
                  return (
                    <Image
                      source={{ uri: imgUrl }}
                      style={{ width: 50, height: 50, borderRadius: 25 }}
                    />
                  );
                }
                return <Ionicons name="person-circle" size={50} color="#3674B5" />;
              })()}
            </View>

            {/* Text */}
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.welcomeText}>
                Welcome back
              </Text>
              <Text style={styles.welcomeTextName}>{user?.firstName + ' ' + user?.lastName || 'Driver'}</Text>
            </View>
          </View>
        </View>


      {/* Salary Card */}
      <TouchableOpacity 
        style={styles.cardContainer}
        onPress={() => router.push('/salary')}
        activeOpacity={0.8}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Salary</Text>
          <Text style={styles.balanceCurrency}>PHP</Text>
        </View>
        <Text style={styles.balanceAmount}>{formatCurrency(totalEarnings)}</Text>
      </TouchableOpacity>




      {/* Chart Controls */}
      <View style={styles.chartControls}>
        <View style={styles.datePickerContainer}>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color="#3674B5" />
            <Text style={styles.datePickerText}>
              {selectedDate.toLocaleDateString('en-US', { 
                month: 'long', 
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
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
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

        {/* Date Picker Modal (matches Route Tab style) */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.dateList}>
                {(() => {
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  
                  // ✅ Calculate days to show based on mounted date (when material was physically installed)
                  let daysToShow = 0; // Default to 0 (show nothing if no mounted date)
                  
                  if (materialMountedAt) {
                    const mountedDate = new Date(materialMountedAt);
                    mountedDate.setHours(0, 0, 0, 0);
                    
                    // Calculate days from mounting to today
                    const daysSinceMounted = Math.floor((now.getTime() - mountedDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    daysToShow = daysSinceMounted;
                    
                    console.log('📅 [Dashboard Date Dropdown] Calculated:', {
                      mountedDate: mountedDate.toDateString(),
                      today: now.toDateString(),
                      daysSinceMounted,
                      daysToShow
                    });
                  } else {
                    console.log('⚠️ [Dashboard Date Dropdown] No mounted date - showing no dates');
                  }
                  
                  // If no dates to show, display a message
                  if (daysToShow === 0) {
                    return (
                      <View style={styles.noDateContainer}>
                        <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                        <Text style={styles.noDateText}>No dates available</Text>
                        <Text style={styles.noDateSubtext}>Material not mounted yet</Text>
                      </View>
                    );
                  }
                  
                  return Array.from({ length: daysToShow }, (_, i) => {
                    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
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
                            weekday: 'long',
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </Text>
                        {i === 0 && (
                          <View style={styles.todayBadgeInline}>
                            <Text style={styles.todayBadgeInlineText}>Today</Text>
                          </View>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#3674B5" />
                      )}
                    </TouchableOpacity>
                  );
                  });
                })()}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

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

      {/* Circular Gauge Display */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeCard}>
          
          {/* Circular Progress */}
          <View style={styles.circularGaugeWrapper}>
            <Svg width={220} height={220} style={styles.circularGauge}>
              {/* Background Circle */}
              <Circle
                cx="110"
                cy="110"
                r="90"
                stroke="#E5E7EB"
                strokeWidth="14"
                fill="none"
              />
              {/* Progress Circle */}
              <Circle
                cx="110"
                cy="110"
                r="90"
                stroke="#3674B5"
                strokeWidth="14"
                fill="none"
                strokeDasharray={`${Math.min((getCurrentMetricValue() / (selectedMetric === 'distance' ? 100 : 10)) * 565, 565)} 565`}
                strokeLinecap="round"
                rotation="-90"
                origin="110, 110"
              />
            </Svg>
            
            {/* Value in Center */}
            <View style={styles.gaugeValueContainer}>
              <Text style={styles.gaugeValue}>
                {(() => {
                  const v = getCurrentMetricValue();
                  if (selectedMetric === 'distance') return v.toFixed(1);
                  if (selectedMetric === 'hours') return v.toFixed(2);
                  return v.toFixed(0);
                })()}
              </Text>
              <Text style={styles.gaugeUnit}>{getMetricUnit()}</Text>
            </View>
          </View>
          
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

      {/* Last 7 Days Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>
          Last 7 Days {getMetricShortLabel()} ({getMetricUnit()})
        </Text>
        {chartData && chartData.datasets && chartData.datasets.length > 0 ? (
          <LineChart
            data={chartData}
            width={screenWidth - 80}
            height={180}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(54, 116, 181, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: '#3674B5'
              }
            }}
            bezier
            style={styles.chart}
            onDataPointClick={handleDataPointClick}
          />
        ) : (
          <>
            <View style={styles.noDataIndicator}>
              <View style={styles.noDataDot} />
              <Text style={styles.noDataText}>No Data</Text>
            </View>
          </>
        )}
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#f3f4f6',
    marginTop: 40,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileContainer: {
    marginRight: 4,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTextName: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '600',

  },
  welcomeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },

  // Balance Container
  cardContainer: {
    backgroundColor: '#3674B5',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  balanceLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.9,
  },
  
  balanceCurrency: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'right',
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
    marginBottom: 16,
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  datePickerButton: {
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  datePickerText: {
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
    shadowColor: '#3674B5',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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

  // Modal Styles (matches Route Tab)
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
  metricSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  metricButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  metricButtonActive: {
    borderBottomColor: '#3674B5',
  },
  metricButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  metricButtonTextActive: {
    color: '#3674B5',
    fontWeight: '600',
  },

  // Circular Gauge Display
  gaugeContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  gaugeCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  circularGaugeWrapper: {
    position: 'relative',
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  circularGauge: {
    position: 'absolute',
  },
  gaugeValueContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#1f2937',
  },
  gaugeUnit: {
    fontSize: 20,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 4,
  },
  gaugePeriod: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
  },
  
  chartContainer: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 8,
  },
  chart: {
    borderRadius: 16,
  },
  noDataIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  noDataDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3674B5',
    marginRight: 8,
  },
  noDataText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
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
    height: 40,
  },
});

export default Dashboard;
