import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config/api';

interface SalaryCalculation {
  id: string;
  driverId: string;
  materialId: string;
  material: {
    id: string;
    materialId: string;
    materialType: string;
    category: string;
    vehicleType: string;
  };
  calculationPeriod: {
    startDate: string;
    endDate: string;
    periodType: string;
  };
  rawData: {
    totalDistance: number;
    totalHours: number;
    daysWorked: number;
  };
  pricingConfig: {
    vehicleType: string;
    category: string;
    materialType: string;
    distanceRate: number;
    hoursRate: number;
  };
  calculations: {
    distanceComputation: number;
    hoursComputation: number;
    totalSalary: number;
  };
  status: string;
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  notes?: string;
  periodDisplay: string;
  createdAt: string;
  updatedAt: string;
}

interface SalarySummary {
  driverId: string;
  driver: {
    id: string;
    driverId: string;
    firstName: string;
    lastName: string;
    email: string;
    vehicleType: string;
  };
  totalCalculations: number;
  totalSalary: number;
  totalDistanceSalary: number;
  totalHoursSalary: number;
  averageMonthlySalary: number;
  lastCalculationDate?: string;
  currentStatus?: string;
}

interface DailyBreakdown {
  date: string;
  totalDistance: number;
  totalHours: number;
  distanceSalary: number;
  hoursSalary: number;
  dailySalary: number;
}

// Cache configuration
const CACHE_KEYS = {
  SALARY_CALCULATIONS: '@salary_calculations_cache',
  SALARY_SUMMARY: '@salary_summary_cache',
  BREAKDOWN_SUMMARIES: '@breakdown_summaries_cache',
  DAILY_BREAKDOWN: '@daily_breakdown_cache',
};

const CACHE_EXPIRY = {
  CALCULATIONS: 5 * 60 * 1000, // 5 minutes
  SUMMARY: 5 * 60 * 1000, // 5 minutes
  BREAKDOWN_SUMMARIES: 5 * 60 * 1000, // 5 minutes
  DAILY_BREAKDOWN: 5 * 60 * 1000, // 5 minutes
};

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const SalaryScreen: React.FC = () => {
  const router = useRouter();
  const [calculations, setCalculations] = useState<SalaryCalculation[]>([]);
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<SalaryCalculation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  // Store daily breakdown summaries by calculation ID for use in main card
  const [breakdownSummaries, setBreakdownSummaries] = useState<Map<string, {
    totalDistance: number;
    totalHours: number;
    totalSalary: number;
  }>>(new Map());
  const [dataCache, setDataCache] = useState<{
    calculations?: CachedData<SalaryCalculation[]>;
    summary?: CachedData<SalarySummary>;
  }>({});
  const selectedCalculationRef = useRef<SalaryCalculation | null>(null);
  const loadingRef = useRef(false);
  const refreshingRef = useRef(false);

  // ✅ Helper functions for billable calculations (floor to nearest 100m for distance, complete minutes for time)
  const calculateBillableHours = (totalHours: number) => {
    const totalMinutes = Math.floor(totalHours * 60); // Only count full minutes
    return totalMinutes / 60; // Convert back to hours
  };

  const calculateBillableDistance = (totalDistance: number) => {
    const totalMeters = Math.floor(totalDistance * 1000); // Convert to meters and floor
    return totalMeters / 1000; // Convert back to km (1m precision)
  };

  const getIgnoredMeters = (totalDistance: number) => {
    const totalKm = totalDistance;
    const flooredKm = Math.floor(totalDistance * 1000) / 1000;
    const ignoredMeters = Math.round((totalKm - flooredKm) * 1000);
    return ignoredMeters;
  };

  const getIgnoredSeconds = (totalHours: number) => {
    const totalSeconds = Math.floor(totalHours * 3600);
    const ignoredSeconds = totalSeconds % 60;
    return ignoredSeconds;
  };

  // Load cached breakdown summaries on mount
  useEffect(() => {
    const loadCachedBreakdownSummaries = async () => {
      try {
        const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.BREAKDOWN_SUMMARIES);
        if (cachedStr) {
          const cached: CachedData<Array<{ id: string; summary: { totalDistance: number; totalHours: number; totalSalary: number } }>> = JSON.parse(cachedStr);
          const now = Date.now();
          if (now - cached.timestamp < CACHE_EXPIRY.BREAKDOWN_SUMMARIES) {
            // Restore cached summaries to Map
            const summariesMap = new Map<string, { totalDistance: number; totalHours: number; totalSalary: number }>();
            cached.data.forEach(({ id, summary }) => {
              summariesMap.set(id, summary);
            });
            setBreakdownSummaries(summariesMap);
            console.log('📦 Loaded cached breakdown summaries');
          }
        }
      } catch (error) {
        console.error('Error loading cached breakdown summaries:', error);
      }
    };
    loadCachedBreakdownSummaries();
    fetchSalaryData();
  }, []);

  // ✅ Auto-refresh main salary calculations list every 2 minutes
  useEffect(() => {
    // Set up interval to refresh salary data every 2 minutes (120000 ms)
    const refreshInterval = setInterval(() => {
      // Check refs to avoid stale closures
      if (!loadingRef.current && !refreshingRef.current) {
        // Only refresh if not already loading
        console.log('🔄 Auto-refreshing salary calculations list...');
        fetchSalaryData(true, true); // Silent refresh, force bypass cache
      }
    }, 120000); // 2 minutes

    // Cleanup interval when component unmounts
    return () => {
      clearInterval(refreshInterval);
    };
  }, []); // Empty deps - interval runs independently

  // ✅ Auto-refresh daily breakdown every 2 minutes when modal is open
  useEffect(() => {
    if (!modalVisible || !selectedCalculation) {
      return;
    }

    // Set up interval to refresh every 2 minutes (120000 ms)
    // Note: Initial fetch is handled by handleViewDetails, this only handles auto-refresh
    const refreshInterval = setInterval(() => {
      const currentCalculation = selectedCalculationRef.current;
      if (currentCalculation && modalVisible && !loadingBreakdown) {
        // Only refresh if not already loading and modal is still visible
        fetchDailyBreakdown(currentCalculation);
      }
    }, 120000); // 2 minutes

    // Cleanup interval when modal closes or calculation changes
    return () => {
      clearInterval(refreshInterval);
    };
  }, [modalVisible, selectedCalculation?.id, loadingBreakdown]);

  // ✅ Auto-refresh breakdown summaries for main card every 2 minutes
  useEffect(() => {
    // Set up interval to refresh breakdown summaries every 2 minutes (120000 ms)
    const refreshInterval = setInterval(() => {
      // Only refresh if not already loading and we have calculations
      if (!loadingRef.current && !refreshingRef.current && calculations.length > 0) {
        console.log('🔄 Auto-refreshing breakdown summaries for main card...');
        // Refresh summaries for all calculations (force refresh to get latest data)
        calculations.forEach((calc, index) => {
          // Stagger the requests to avoid overwhelming the server
          setTimeout(() => fetchBreakdownSummary(calc, true), index * 500);
        });
      }
    }, 120000); // 2 minutes

    // Cleanup interval when component unmounts
    return () => {
      clearInterval(refreshInterval);
    };
  }, [calculations.length]); // Re-run when calculations change

  // Helper function to normalize dates for comparison
  const normalizeDate = (date: string | Date | undefined): string => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Optimized deduplication function
  const deduplicateCalculations = (calculations: SalaryCalculation[]): SalaryCalculation[] => {
    const seenPeriods = new Map<string, SalaryCalculation>();
    
    for (const calc of calculations) {
      const startDate = normalizeDate(calc.calculationPeriod?.startDate);
      const endDate = normalizeDate(calc.calculationPeriod?.endDate);
      
      const periodKey = (startDate && endDate)
        ? `${calc.driverId}-${startDate}-${endDate}`
        : `${calc.driverId}-${calc.materialId}-${calc.calculationPeriod?.periodType || 'UNKNOWN'}`;
      
      if (!seenPeriods.has(periodKey)) {
        seenPeriods.set(periodKey, calc);
      } else {
        const existing = seenPeriods.get(periodKey)!;
        const existingDate = existing.createdAt ? new Date(existing.createdAt) : new Date(0);
        const currentDate = calc.createdAt ? new Date(calc.createdAt) : new Date(0);
        
        if (!isNaN(currentDate.getTime()) && (!isNaN(existingDate.getTime()) ? currentDate > existingDate : true)) {
          seenPeriods.set(periodKey, calc);
        }
      }
    }
    
    const result = Array.from(seenPeriods.values());
    result.sort((a, b) => {
      const dateA = new Date(a.calculationPeriod?.startDate || 0);
      const dateB = new Date(b.calculationPeriod?.startDate || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return result;
  };

  const fetchSalaryData = async (silent = false, forceRefresh = false) => {
    try {
      if (!silent) {
        setLoading(true);
        loadingRef.current = true;
      }
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // ✅ If force refresh, skip cache completely and fetch immediately
      if (forceRefresh) {
        // Clear cache indicators to ensure fresh fetch
        // Don't check any cache, go straight to API
      } else {
        // Check cache first (only for normal loads)
        const cachedCalculations = dataCache.calculations;
        const cachedSummary = dataCache.summary;
        
        // Check memory cache
        if (cachedCalculations && (Date.now() - cachedCalculations.timestamp) < CACHE_EXPIRY.CALCULATIONS) {
          setCalculations(cachedCalculations.data);
          if (!silent) setLoading(false);
        }
        
        if (cachedSummary && (Date.now() - cachedSummary.timestamp) < CACHE_EXPIRY.SUMMARY) {
          setSummary(cachedSummary.data);
        }
        
        // If we have valid cache for both, return early
        if (cachedCalculations && cachedSummary && 
            (Date.now() - cachedCalculations.timestamp) < CACHE_EXPIRY.CALCULATIONS &&
            (Date.now() - cachedSummary.timestamp) < CACHE_EXPIRY.SUMMARY) {
          if (!silent) setLoading(false);
          setRefreshing(false);
          return;
        }
        
        // Check AsyncStorage cache
        try {
          const calculationsCacheStr = await AsyncStorage.getItem(CACHE_KEYS.SALARY_CALCULATIONS);
          const summaryCacheStr = await AsyncStorage.getItem(CACHE_KEYS.SALARY_SUMMARY);
          
          if (calculationsCacheStr && !cachedCalculations) {
            const cached: CachedData<SalaryCalculation[]> = JSON.parse(calculationsCacheStr);
            if ((Date.now() - cached.timestamp) < CACHE_EXPIRY.CALCULATIONS) {
              setCalculations(cached.data);
              setDataCache(prev => ({ ...prev, calculations: cached }));
              if (!silent) setLoading(false);
            }
          }
          
          if (summaryCacheStr && !cachedSummary) {
            const cached: CachedData<SalarySummary> = JSON.parse(summaryCacheStr);
            if ((Date.now() - cached.timestamp) < CACHE_EXPIRY.SUMMARY) {
              setSummary(cached.data);
              setDataCache(prev => ({ ...prev, summary: cached }));
            }
          }
        } catch (cacheError) {
          // Ignore cache errors
        }
      }

      // ✅ OPTIMIZATION: Fetch both queries in parallel
      const [calculationsResponse, summaryResponse] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(forceRefresh ? {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            } : {}),
          },
          body: JSON.stringify({
            query: `
              query GetMySalaryCalculations {
                getMySalaryCalculations {
                  success
                  message
                  calculations {
                    id
                    driverId
                    materialId
                    material {
                      id
                      materialId
                      materialType
                      category
                      vehicleType
                    }
                    calculationPeriod {
                      startDate
                      endDate
                      periodType
                    }
                    rawData {
                      totalDistance
                      totalHours
                      daysWorked
                    }
                    pricingConfig {
                      vehicleType
                      category
                      materialType
                      distanceRate
                      hoursRate
                    }
                    calculations {
                      distanceComputation
                      hoursComputation
                      totalSalary
                    }
                    status
                    approvedAt
                    paidAt
                    paymentReference
                    notes
                    periodDisplay
                    createdAt
                    updatedAt
                  }
                  totalCount
                }
              }
            `,
          }),
        }),
        fetch(`${API_CONFIG.BASE_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(forceRefresh ? {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
            } : {}),
          },
          body: JSON.stringify({
            query: `
              query GetMySalarySummary {
                getMySalarySummary {
                  success
                  message
                  summary {
                    driverId
                    driver {
                      id
                      driverId
                      firstName
                      lastName
                      email
                      vehicleType
                    }
                    totalCalculations
                    totalSalary
                    totalDistanceSalary
                    totalHoursSalary
                    averageMonthlySalary
                    lastCalculationDate
                    currentStatus
                  }
                }
              }
            `,
          }),
        }),
      ]);

      // Process both responses in parallel
      const [calculationsData, summaryData] = await Promise.all([
        calculationsResponse.json(),
        summaryResponse.json(),
      ]);
      
      // Process calculations
      if (calculationsData.errors) {
        console.error('GraphQL errors in getMySalaryCalculations:', calculationsData.errors);
        throw new Error(calculationsData.errors[0]?.message || 'Failed to fetch salary calculations');
      }
      
      if (calculationsData.data?.getMySalaryCalculations?.success) {
        const fetchedCalculations = calculationsData.data.getMySalaryCalculations.calculations || [];
        const deduplicatedCalculations = deduplicateCalculations(fetchedCalculations);
        
        setCalculations(deduplicatedCalculations);
        
        // Cache the results
        const cacheData: CachedData<SalaryCalculation[]> = {
          data: deduplicatedCalculations,
          timestamp: Date.now(),
        };
        setDataCache(prev => ({ ...prev, calculations: cacheData }));
        await AsyncStorage.setItem(CACHE_KEYS.SALARY_CALCULATIONS, JSON.stringify(cacheData));
        
        // Fetch breakdown summaries immediately for all calculations (frontend calculation)
        // Fetch first calculation immediately, then stagger the rest
        if (deduplicatedCalculations.length > 0) {
          // Fetch first calculation immediately (no delay)
          fetchBreakdownSummary(deduplicatedCalculations[0], silent);
          // Stagger the rest to avoid overwhelming the server
          deduplicatedCalculations.slice(1).forEach((calc, index) => {
            setTimeout(() => fetchBreakdownSummary(calc, silent), (index + 1) * 300);
          });
        }
      } else {
        setCalculations([]);
      }

      // Process summary
      if (summaryData.errors) {
        console.error('GraphQL errors in getMySalarySummary:', summaryData.errors);
      } else if (summaryData.data?.getMySalarySummary?.success) {
        const summaryResult = summaryData.data.getMySalarySummary.summary;
        setSummary(summaryResult);
        
        // Cache the summary
        const cacheData: CachedData<SalarySummary> = {
          data: summaryResult,
          timestamp: Date.now(),
        };
        setDataCache(prev => ({ ...prev, summary: cacheData }));
        await AsyncStorage.setItem(CACHE_KEYS.SALARY_SUMMARY, JSON.stringify(cacheData));
      }

    } catch (error) {
      console.error('Error fetching salary data:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to fetch salary data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
      refreshingRef.current = false;
    }
  };

  const onRefresh = async () => {
    // Immediately show refresh indicator and fetch fresh data
    setRefreshing(true);
    refreshingRef.current = true;
    // Force refresh: skip all cache and fetch immediately from API
    await fetchSalaryData(true, true);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return '#F59E0B';
      case 'calculated':
        return '#3B82F6';
      case 'approved':
        return '#10B981';
      case 'paid':
        return '#059669';
      case 'disputed':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'time-outline';
      case 'calculated':
        return;
      case 'approved':
        return;
      case 'paid':
        return;
      case 'disputed':
        return;
      default:
        return;
    }
  };

  const formatVehicleType = (vehicleType: string): string => {
    if (vehicleType === 'E_TRIKE') return 'E TRIKE';
    return vehicleType;
  };

  const formatCategory = (category: string): string => {
    if (category === 'NON_DIGITAL') return 'NON DIGITAL';
    return category;
  };

  // Helper function to fetch and store daily breakdown summary for a calculation
  const fetchBreakdownSummary = async (calculation: SalaryCalculation, forceRefresh = false) => {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      // Check memory cache
      if (breakdownSummaries.has(calculation.id)) {
        return;
      }
      
      // Check AsyncStorage cache
      try {
        const cachedStr = await AsyncStorage.getItem(CACHE_KEYS.BREAKDOWN_SUMMARIES);
        if (cachedStr) {
          const cached: CachedData<Array<{ id: string; summary: { totalDistance: number; totalHours: number; totalSalary: number } }>> = JSON.parse(cachedStr);
          const now = Date.now();
          if (now - cached.timestamp < CACHE_EXPIRY.BREAKDOWN_SUMMARIES) {
            const cachedSummary = cached.data.find(item => item.id === calculation.id);
            if (cachedSummary) {
              // Restore from cache
              setBreakdownSummaries(prev => {
                const newMap = new Map(prev);
                newMap.set(calculation.id, cachedSummary.summary);
                return newMap;
              });
              console.log('📦 Using cached breakdown summary for calculation:', calculation.id);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error checking cache for breakdown summary:', error);
      }
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const startDateValue = calculation.calculationPeriod?.startDate;
      const endDateValue = calculation.calculationPeriod?.endDate;
      if (!startDateValue || !endDateValue) return;

      let startDate: Date;
      let endDate: Date;
      try {
        if (typeof startDateValue === 'string' && /^\d+$/.test(startDateValue)) {
          startDate = new Date(parseInt(startDateValue, 10));
        } else {
          startDate = new Date(startDateValue);
        }
        if (typeof endDateValue === 'string' && /^\d+$/.test(endDateValue)) {
          endDate = new Date(parseInt(endDateValue, 10));
        } else {
          endDate = new Date(endDateValue);
        }
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
      } catch {
        return;
      }

      const apiUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${calculation.driverId}?period=daily&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&_t=${Date.now()}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      if (!response.ok) return;
      const data = await response.json();
      const dailyData = data.data?.dailyData?.dailyBreakdown || data.dailyData?.dailyBreakdown || [];

      const breakdown: DailyBreakdown[] = dailyData.map((day: any) => {
        const rawDistance = day.totalDistanceTraveled || day.totalDistance || 0;
        const rawHours = day.totalHoursOnline || day.totalHours || 0;
        const billableDistance = calculateBillableDistance(rawDistance);
        const billableHours = calculateBillableHours(rawHours);
        const distanceRate = calculation.pricingConfig?.distanceRate || 0;
        const hoursRate = calculation.pricingConfig?.hoursRate || 0;
        const distanceSalary = billableDistance * distanceRate;
        const hoursSalary = billableHours * hoursRate;
        const dailySalary = distanceSalary + hoursSalary;
        return {
          date: day.date,
          totalDistance: billableDistance,
          totalHours: billableHours,
          distanceSalary: Math.round(distanceSalary * 100) / 100,
          hoursSalary: Math.round(hoursSalary * 100) / 100,
          dailySalary: Math.round(dailySalary * 100) / 100,
        };
      });

      const totalDistance = breakdown.reduce((sum, day) => sum + day.totalDistance, 0);
      const totalHours = breakdown.reduce((sum, day) => sum + day.totalHours, 0);
      const totalSalary = breakdown.reduce((sum, day) => sum + day.dailySalary, 0);

      setBreakdownSummaries(prev => {
        const newMap = new Map(prev);
        const summary = {
          totalDistance,
          totalHours,
          totalSalary: Math.round(totalSalary * 100) / 100,
        };
        newMap.set(calculation.id, summary);
        
        // Save to cache
        const cacheData: CachedData<Array<{ id: string; summary: typeof summary }>> = {
          data: Array.from(newMap.entries()).map(([id, summary]) => ({ id, summary })),
          timestamp: Date.now(),
        };
        AsyncStorage.setItem(CACHE_KEYS.BREAKDOWN_SUMMARIES, JSON.stringify(cacheData)).catch(err => {
          console.error('Error saving breakdown summaries to cache:', err);
        });
        
        return newMap;
      });
    } catch (error) {
      // Silently fail - we'll use cached data if available
      console.log('Could not fetch breakdown summary for calculation:', calculation.id);
    }
  };

  const fetchDailyBreakdown = async (calculation: SalaryCalculation, forceRefresh = false) => {
    try {
      setLoadingBreakdown(true);
      console.log('📊 Fetching daily breakdown (Distance + Hours) for calculation:', calculation.id, forceRefresh ? '(forced refresh)' : '');
      
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        try {
          const cacheKey = `${CACHE_KEYS.DAILY_BREAKDOWN}_${calculation.id}`;
          const cachedStr = await AsyncStorage.getItem(cacheKey);
          if (cachedStr) {
            const cached: CachedData<DailyBreakdown[]> = JSON.parse(cachedStr);
            const now = Date.now();
            if (now - cached.timestamp < CACHE_EXPIRY.DAILY_BREAKDOWN) {
              // Use cached data
              setDailyBreakdown(cached.data);
              setLoadingBreakdown(false);
              console.log('📦 Using cached daily breakdown for calculation:', calculation.id);
              
              // Still update summary from cached breakdown
              const totalDistance = cached.data.reduce((sum, day) => sum + day.totalDistance, 0);
              const totalHours = cached.data.reduce((sum, day) => sum + day.totalHours, 0);
              const totalSalary = cached.data.reduce((sum, day) => sum + day.dailySalary, 0);
              setBreakdownSummaries(prev => {
                const newMap = new Map(prev);
                const summary = {
                  totalDistance,
                  totalHours,
                  totalSalary: Math.round(totalSalary * 100) / 100,
                };
                newMap.set(calculation.id, summary);
                return newMap;
              });
              
              // Fetch fresh data in background
              fetchDailyBreakdown(calculation, true).catch(() => {});
              return;
            }
          }
        } catch (cacheError) {
          console.error('Error checking cache for daily breakdown:', cacheError);
        }
      }
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // Validate and parse dates safely
      let startDate: Date;
      let endDate: Date;

      try {
        const startDateValue = calculation.calculationPeriod?.startDate;
        const endDateValue = calculation.calculationPeriod?.endDate;

        if (!startDateValue || !endDateValue) {
          throw new Error('Missing date values in calculation period');
        }

        // Parse dates - handle both string and number timestamps
        let startDateParsed: Date;
        let endDateParsed: Date;

        if (typeof startDateValue === 'string' && /^\d+$/.test(startDateValue)) {
          startDateParsed = new Date(parseInt(startDateValue, 10));
        } else {
          startDateParsed = new Date(startDateValue);
        }

        if (typeof endDateValue === 'string' && /^\d+$/.test(endDateValue)) {
          endDateParsed = new Date(parseInt(endDateValue, 10));
        } else {
          endDateParsed = new Date(endDateValue);
        }

        // Validate dates
        if (isNaN(startDateParsed.getTime()) || isNaN(endDateParsed.getTime())) {
          throw new Error('Invalid date values');
        }

        startDate = new Date(startDateParsed);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endDateParsed);
        endDate.setHours(23, 59, 59, 999);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Date manipulation resulted in invalid dates');
        }
      } catch (dateError) {
        console.error('Error parsing dates for daily breakdown:', dateError);
        setDailyBreakdown([]);
        setLoadingBreakdown(false);
        return;
      }

      // ✅ Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const apiUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${calculation.driverId}?period=daily&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&_t=${timestamp}`;
      
      // ✅ OPTIMIZATION: Add timeout to prevent long waits (2 minutes max)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout: Daily breakdown took too long to load')), 120000); // 2 minutes
      });
      
      const fetchPromise = fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`Failed to fetch daily breakdown: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract daily breakdown data
      const dailyData = data.data?.dailyData?.dailyBreakdown || data.dailyData?.dailyBreakdown || [];
      
      // Calculate daily salary for each day (with billable flooring)
      const breakdown: DailyBreakdown[] = dailyData.map((day: any) => {
        // API returns totalDistanceTraveled and totalHoursOnline
        const rawDistance = day.totalDistanceTraveled || day.totalDistance || 0;
        const rawHours = day.totalHoursOnline || day.totalHours || 0;
        
        const billableDistance = calculateBillableDistance(rawDistance);
        const billableHours = calculateBillableHours(rawHours);
        
        const distanceRate = calculation.pricingConfig?.distanceRate || 0;
        const hoursRate = calculation.pricingConfig?.hoursRate || 0;
        
        const distanceSalary = billableDistance * distanceRate;
        const hoursSalary = billableHours * hoursRate;
        const dailySalary = distanceSalary + hoursSalary;
        
        return {
          date: day.date,
          totalDistance: billableDistance,
          totalHours: billableHours,
          distanceSalary: Math.round(distanceSalary * 100) / 100,
          hoursSalary: Math.round(hoursSalary * 100) / 100,
          dailySalary: Math.round(dailySalary * 100) / 100,
        };
      });

      // Sort by date (oldest first)
      breakdown.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateA.getTime() - dateB.getTime();
      });

      // Calculate totals for logging
      const totalDistance = breakdown.reduce((sum, day) => sum + day.totalDistance, 0);
      const totalHours = breakdown.reduce((sum, day) => sum + day.totalHours, 0);
      const totalDistanceSalary = breakdown.reduce((sum, day) => sum + day.distanceSalary, 0);
      const totalHoursSalary = breakdown.reduce((sum, day) => sum + day.hoursSalary, 0);
      
      // Calculate total salary from daily breakdown
      const totalSalary = breakdown.reduce((sum, day) => sum + day.dailySalary, 0);
      
      console.log(`✅ Daily breakdown fetched: ${breakdown.length} days`);
      console.log(`📊 Distance: ${totalDistance.toFixed(3)} km (P${totalDistanceSalary.toFixed(2)})`);
      console.log(`⏱️ Hours: ${Math.floor(totalHours * 60)} min (P${totalHoursSalary.toFixed(2)})`);
      console.log(`💰 Total Salary: P${totalSalary.toFixed(2)}`);
      
      setDailyBreakdown(breakdown);
      
      // Save to cache
      try {
        const cacheKey = `${CACHE_KEYS.DAILY_BREAKDOWN}_${calculation.id}`;
        const cacheData: CachedData<DailyBreakdown[]> = {
          data: breakdown,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('💾 Saved daily breakdown to cache for calculation:', calculation.id);
      } catch (cacheError) {
        console.error('Error saving daily breakdown to cache:', cacheError);
      }
      
      // Store summary for use in main card
      setBreakdownSummaries(prev => {
        const newMap = new Map(prev);
        const summary = {
          totalDistance,
          totalHours,
          totalSalary: Math.round(totalSalary * 100) / 100,
        };
        newMap.set(calculation.id, summary);
        
        // Save to cache
        const cacheData: CachedData<Array<{ id: string; summary: typeof summary }>> = {
          data: Array.from(newMap.entries()).map(([id, summary]) => ({ id, summary })),
          timestamp: Date.now(),
        };
        AsyncStorage.setItem(CACHE_KEYS.BREAKDOWN_SUMMARIES, JSON.stringify(cacheData)).catch(err => {
          console.error('Error saving breakdown summaries to cache:', err);
        });
        
        return newMap;
      });
    } catch (error) {
      console.error('❌ Error fetching daily breakdown:', error);
      if (error instanceof Error && error.message.includes('timeout')) {
        Alert.alert('Timeout', 'Loading daily breakdown took too long. Please try again.');
      } else if (error instanceof Error) {
        Alert.alert('Error', `Failed to refresh data: ${error.message}`);
      }
      // Don't clear existing data on error, keep what was there
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleViewDetails = async (calculation: SalaryCalculation) => {
    setSelectedCalculation(calculation);
    selectedCalculationRef.current = calculation;
    setModalVisible(true);
    
    // Try to load cached data first for instant display
    try {
      const cacheKey = `${CACHE_KEYS.DAILY_BREAKDOWN}_${calculation.id}`;
      const cachedStr = await AsyncStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached: CachedData<DailyBreakdown[]> = JSON.parse(cachedStr);
        const now = Date.now();
        if (now - cached.timestamp < CACHE_EXPIRY.DAILY_BREAKDOWN) {
          // Load cached data immediately
          setDailyBreakdown(cached.data);
          console.log('📦 Loaded cached daily breakdown for instant display');
          
          // Update summary from cached breakdown
          const totalDistance = cached.data.reduce((sum, day) => sum + day.totalDistance, 0);
          const totalHours = cached.data.reduce((sum, day) => sum + day.totalHours, 0);
          const totalSalary = cached.data.reduce((sum, day) => sum + day.dailySalary, 0);
          setBreakdownSummaries(prev => {
            const newMap = new Map(prev);
            const summary = {
              totalDistance,
              totalHours,
              totalSalary: Math.round(totalSalary * 100) / 100,
            };
            newMap.set(calculation.id, summary);
            return newMap;
          });
        }
      }
    } catch (cacheError) {
      console.error('Error loading cached daily breakdown:', cacheError);
    }
    
    // Fetch fresh data (will use cache if available and not expired)
    await fetchDailyBreakdown(calculation);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading salary data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Salary</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Calculations List */}
        <View style={styles.calculationsSection}>
          <Text style={styles.sectionTitle}>Salary Calculations</Text>
          
          {calculations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calculator-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No salary calculations found</Text>
              <Text style={styles.emptySubtext}>
                Your salary calculations will appear here once they are generated by the admin.
              </Text>
            </View>
          ) : (
            calculations.map((calculation) => (
              <TouchableOpacity
                key={calculation.id}
                style={styles.calculationCard}
                onPress={() => handleViewDetails(calculation)}
              >
                <View style={styles.calculationHeader}>
                  <View style={styles.calculationInfo}>
                    <Text style={styles.calculationPeriod}>{calculation.periodDisplay || 'N/A'}</Text>
                    <Text style={styles.calculationType}>{calculation.calculationPeriod?.periodType || 'N/A'}</Text>
                  </View>
                  <View style={styles.calculationStatus}>
                    <Ionicons
                      name={getStatusIcon(calculation.status || 'PENDING')}
                      size={20}
                      color={getStatusColor(calculation.status || 'PENDING')}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(calculation.status || 'PENDING') }]}>
                      {calculation.status || 'PENDING'}
                    </Text>
                  </View>
                </View>

                {/* Pricing Configuration */}
                <View style={styles.pricingConfigSection}>
                  <View style={styles.pricingConfigHeader}>
                    <Text style={styles.pricingConfigTitle}>
                      {calculation.pricingConfig.materialType} {formatVehicleType(calculation.pricingConfig.vehicleType)}
                    </Text>
                    <View style={styles.pricingConfigBadge}>
                      <Text style={styles.pricingConfigBadgeText}>
                        {formatCategory(calculation.pricingConfig.category)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pricingConfigRates}>
                    <View style={styles.pricingConfigRateRow}>
                      <Ionicons name="map-outline" size={14} color="#6B7280" />
                      <Text style={styles.pricingConfigRateLabel}>Distance Rate:</Text>
                      <Text style={styles.pricingConfigRateValue}>
                        {formatCurrency(calculation.pricingConfig.distanceRate)}/km
                      </Text>
                    </View>
                    <View style={styles.pricingConfigRateRow}>
                      <Ionicons name="time-outline" size={14} color="#6B7280" />
                      <Text style={styles.pricingConfigRateLabel}>Hours Rate:</Text>
                      <Text style={styles.pricingConfigRateValue}>
                        {formatCurrency(calculation.pricingConfig.hoursRate)}/hour
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.calculationDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distance:</Text>
                    <Text style={styles.detailValue}>
                      {/* Only show frontend calculation from daily breakdown summary */}
                      {(() => {
                        const summary = breakdownSummaries.get(calculation.id);
                        if (summary) {
                          return summary.totalDistance.toFixed(3);
                        }
                        // Show loading state - don't show backend rawData
                        return '...';
                      })()} km
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hours:</Text>
                    <Text style={styles.detailValue}>
                      {/* Only show frontend calculation from daily breakdown summary */}
                      {(() => {
                        const summary = breakdownSummaries.get(calculation.id);
                        if (summary) {
                          return Math.floor(summary.totalHours * 60);
                        }
                        // Show loading state - don't show backend rawData
                        return '...';
                      })()} min
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Salary:</Text>
                    <Text style={styles.totalSalary}>
                      {/* Only show frontend calculation from daily breakdown summary */}
                      {(() => {
                        const summary = breakdownSummaries.get(calculation.id);
                        if (summary) {
                          // Use frontend-calculated total from daily breakdown
                          return formatCurrency(summary.totalSalary);
                        }
                        // Show loading state - don't show backend calculation
                        return '...';
                      })()}
                    </Text>
                  </View>
                  <Text style={styles.billableIndicator}>✓ Approx. billable (tap for daily breakdown)</Text>
                </View>
                
                <View style={styles.calculationFooter}>
                  <Text style={styles.footerText}>
                    Created: {calculation.createdAt ? formatDate(calculation.createdAt) : 'N/A'}
                  </Text>
                  {calculation.paidAt && (
                    <Text style={styles.footerText}>
                      Paid: {formatDate(calculation.paidAt)}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          setDailyBreakdown([]);
          selectedCalculationRef.current = null;
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Salary Calculation Details</Text>
            <View style={styles.modalHeaderButtons}>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedCalculation && !loadingBreakdown) {
                    console.log('🔄 Manual refresh triggered');
                    await fetchDailyBreakdown(selectedCalculation, true);
                  }
                }}
                style={styles.refreshButton}
                disabled={loadingBreakdown || !selectedCalculation}
              >
                <Ionicons 
                  name={loadingBreakdown ? "hourglass-outline" : "refresh"} 
                  size={24} 
                  color={loadingBreakdown ? "#9CA3AF" : "#374151"} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setDailyBreakdown([]);
                  selectedCalculationRef.current = null;
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {selectedCalculation && (
            <ScrollView style={styles.modalContent}>
              {/* Period Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Period Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Period:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.periodDisplay || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.calculationPeriod?.periodType || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Days Worked:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.rawData?.daysWorked || 0} days</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Distance Rate:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedCalculation.pricingConfig?.distanceRate || 0)}/km
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hours Rate:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedCalculation.pricingConfig?.hoursRate || 0)}/hour
                  </Text>
                </View>
              </View>

              {/* Billable Data (Summed from Daily) */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Billable Data</Text>
                <View style={styles.rawDataGrid}>
                  <View style={styles.rawDataItemCard}>
                    <Text style={styles.rawDataValue}>
                      {/* Only show frontend calculation from daily breakdown */}
                      {dailyBreakdown.length > 0 
                        ? dailyBreakdown.reduce((sum, day) => sum + day.totalDistance, 0).toFixed(2)
                        : '...'
                      }
                    </Text>
                    <Text style={styles.rawDataLabel}>Total Distance (km)</Text>
                  </View>
                  <View style={styles.rawDataItemCard}>
                    <Text style={styles.rawDataValue}>
                      {/* Only show frontend calculation from daily breakdown */}
                      {dailyBreakdown.length > 0
                        ? dailyBreakdown.reduce((sum, day) => sum + Math.floor(day.totalHours * 60), 0)
                        : '...'
                      }
                    </Text>
                    <Text style={styles.rawDataLabel}>Total Minutes</Text>
                  </View>
                  <View style={styles.rawDataItemCard}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData?.daysWorked || 0}</Text>
                    <Text style={styles.rawDataLabel}>Days Worked</Text>
                  </View>
                </View>
                <View style={styles.billableNoteBanner}>
                  <Text style={styles.billableNoteBannerText}>
                    ✓ Sum of daily floored values (per meter, complete minutes)
                  </Text>
                </View>
              </View>

              {/* Calculations (Billable) - Summed from Daily Breakdown */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Salary Calculations</Text>
                <View style={styles.calculationGrid}>
                  <View style={styles.calculationRow}>
                    <View style={styles.calculationItem}>
                      <Text style={styles.calculationValue}>
                        {(() => {
                          // Only use frontend calculation from daily breakdown
                          if (dailyBreakdown.length > 0) {
                            const totalDistanceSalary = dailyBreakdown.reduce((sum, day) => sum + day.distanceSalary, 0);
                            return formatCurrency(Math.round(totalDistanceSalary * 100) / 100);
                          }
                          // Show loading - don't show backend calculation
                          return '...';
                        })()}
                      </Text>
                      <Text style={styles.calculationLabel}>Distance Computation</Text>
                      <Text style={styles.calculationFormula}>
                        {/* Only use frontend calculation from daily breakdown */}
                        {(() => {
                          if (dailyBreakdown.length > 0) {
                            const totalKm = dailyBreakdown.reduce((sum, day) => sum + day.totalDistance, 0);
                            return `${totalKm.toFixed(2)} km × ${formatCurrency(selectedCalculation.pricingConfig?.distanceRate || 0)}/km`;
                          }
                          return '...';
                        })()}
                      </Text>
                    </View>
                    <View style={styles.calculationItem}>
                      <Text style={styles.calculationValue}>
                        {(() => {
                          // Only use frontend calculation from daily breakdown
                          if (dailyBreakdown.length > 0) {
                            const totalHoursSalary = dailyBreakdown.reduce((sum, day) => sum + day.hoursSalary, 0);
                            return formatCurrency(Math.round(totalHoursSalary * 100) / 100);
                          }
                          // Show loading - don't show backend calculation
                          return '...';
                        })()}
                      </Text>
                      <Text style={styles.calculationLabel}>Hours Computation</Text>
                      <Text style={styles.calculationFormula}>
                        {/* Only use frontend calculation from daily breakdown */}
                        {(() => {
                          if (dailyBreakdown.length > 0) {
                            const totalMinutes = dailyBreakdown.reduce((sum, day) => sum + Math.floor(day.totalHours * 60), 0);
                            return `${totalMinutes} min × ${formatCurrency(selectedCalculation.pricingConfig?.hoursRate || 0)}/hour`;
                          }
                          return '...';
                        })()}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.calculationItem, styles.totalCalculationItem]}>
                    <Text style={styles.totalCalculationValue}>
                      {(() => {
                        // Only use frontend calculation from daily breakdown
                        if (dailyBreakdown.length > 0) {
                          const totalSalary = dailyBreakdown.reduce((sum, day) => sum + day.dailySalary, 0);
                          return formatCurrency(Math.round(totalSalary * 100) / 100);
                        }
                        // Show loading - don't show backend calculation
                        return '...';
                      })()}
                    </Text>
                    <Text style={styles.totalCalculationLabel}>Total Salary (Billable)</Text>
                    <Text style={styles.totalCalculationFormula}>
                      {dailyBreakdown.length > 0 ? 'Sum of daily floored values' : 'Loading...'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Daily Breakdown */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Daily Breakdown</Text>
                {loadingBreakdown ? (
                  <View style={styles.loadingBreakdown}>
                    <Text style={styles.loadingText}>Loading daily breakdown...</Text>
                  </View>
                ) : dailyBreakdown.length > 0 ? (
                  <View style={styles.dailyBreakdownContainer}>
                    {dailyBreakdown.map((day, index) => (
                      <View key={index} style={styles.dailyBreakdownItem}>
                        <View style={styles.dailyBreakdownHeader}>
                          <Text style={styles.dailyBreakdownDate}>
                            {formatDate(day.date)}
                          </Text>
                          <Text style={[
                            styles.dailyBreakdownSalary,
                            day.dailySalary > 1 ? styles.dailyBreakdownSalaryGreen : styles.dailyBreakdownSalaryZero
                          ]}>
                            {formatCurrency(day.dailySalary)}
                          </Text>
                        </View>
                        <View style={styles.dailyBreakdownDetails}>
                          <View style={styles.dailyBreakdownRow}>
                            <Text style={styles.dailyBreakdownLabel}>Distance:</Text>
                            <Text style={styles.dailyBreakdownValue}>
                              {day.totalDistance.toFixed(3)} km
                            </Text>
                            <Text style={[
                              styles.dailyBreakdownSalary,
                              day.distanceSalary > 1 ? styles.dailyBreakdownSalaryGreen : styles.dailyBreakdownSalaryZero
                            ]}>
                              {formatCurrency(day.distanceSalary)}
                            </Text>
                          </View>
                          <View style={styles.dailyBreakdownRow}>
                            <Text style={styles.dailyBreakdownLabel}>Hours:</Text>
                            <Text style={styles.dailyBreakdownValue}>
                              {Math.floor(day.totalHours * 60)} min
                            </Text>
                            <Text style={[
                              styles.dailyBreakdownSalary,
                              day.hoursSalary > 1 ? styles.dailyBreakdownSalaryGreen : styles.dailyBreakdownSalaryZero
                            ]}>
                              {formatCurrency(day.hoursSalary)}
                            </Text>
                          </View>
                          <View style={styles.dailyBreakdownBillableNote}>
                            <Text style={styles.billableNoteText}>
                              ✓ Billable only (per meter, complete minutes)
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                    <View style={styles.dailyBreakdownTotal}>
                      <Text style={styles.dailyBreakdownTotalLabel}>Total Days</Text>
                      <Text style={styles.dailyBreakdownTotalValue}>
                        {dailyBreakdown.length} days
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.detailValue}>No daily breakdown data available</Text>
                )}
              </View>

              {/* Status Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Status Information</Text>
                <View style={styles.statusContainer}>
                  <Ionicons
                    name={getStatusIcon(selectedCalculation.status || 'PENDING')}
                    size={24}
                    color={getStatusColor(selectedCalculation.status || 'PENDING')}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(selectedCalculation.status || 'PENDING') }]}>
                    {selectedCalculation.status || 'PENDING'}
                  </Text>
                </View>
                {selectedCalculation.approvedAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Approved:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedCalculation.approvedAt)}</Text>
                  </View>
                )}
                {selectedCalculation.paidAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Paid:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedCalculation.paidAt)}</Text>
                  </View>
                )}
                {selectedCalculation.paymentReference && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment Reference:</Text>
                    <Text style={styles.detailValue}>{selectedCalculation.paymentReference}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: {
    width: 36,
    color: '#000000',
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  summaryContainer: {
    margin: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  summaryItemCard: {
    flex: 1,
    backgroundColor: '#3674B5',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 19,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  calculationsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  calculationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calculationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calculationInfo: {
    flex: 1,
  },
  calculationPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  calculationType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  calculationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  pricingConfigSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pricingConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pricingConfigTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  pricingConfigBadge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  pricingConfigBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  pricingConfigRates: {
    gap: 8,
  },
  pricingConfigRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pricingConfigRateLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  pricingConfigRateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  calculationDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  totalSalary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  calculationFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    justifyContent: 'flex-end',
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 0,
    
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  rawDataGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  rawDataItemCard: {
    flex: 1,
    backgroundColor: '#3674B5',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  rawDataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  rawDataLabel: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
  },
  calculationGrid: {
    gap: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calculationItem: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  totalCalculationItem: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    
  },
  calculationValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  totalCalculationValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  calculationLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  totalCalculationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 4,
  },
  calculationFormula: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  totalCalculationFormula: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  loadingBreakdown: {
    padding: 20,
    alignItems: 'center',
  },
  dailyBreakdownContainer: {
    gap: 12,
  },
  dailyBreakdownItem: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  dailyBreakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dailyBreakdownDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  dailyBreakdownDetails: {
    gap: 6,
  },
  dailyBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyBreakdownLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  dailyBreakdownValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
    marginRight: 12,
  },
  dailyBreakdownSalary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    minWidth: 80,
    textAlign: 'right',
  },
  dailyBreakdownSalaryZero: {
    color: '#000000',
  },
  dailyBreakdownSalaryGreen: {
    color: '#059669',
  },
  dailyBreakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
  },
  dailyBreakdownTotalLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  dailyBreakdownTotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  dailyBreakdownBillableNote: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  billableNoteText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
    textAlign: 'center',
  },
  billableNoteBanner: {
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    padding: 8,
  },
  billableNoteBannerText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    textAlign: 'center',
  },
  billableIndicator: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'right',
  },
});

export default SalaryScreen;
