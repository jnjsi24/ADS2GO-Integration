import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchSalaryData();
  }, []);

  const fetchSalaryData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No auth token found');
      }

      // Fetch salary calculations
      const calculationsResponse = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
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
      });

      const calculationsData = await calculationsResponse.json();
      
      // Check for GraphQL errors
      if (calculationsData.errors) {
        console.error('GraphQL errors in getMySalaryCalculations:', calculationsData.errors);
        throw new Error(calculationsData.errors[0]?.message || 'Failed to fetch salary calculations');
      }
      
      // Check response structure and success flag
      if (calculationsData.data?.getMySalaryCalculations?.success) {
        const fetchedCalculations = calculationsData.data.getMySalaryCalculations.calculations || [];
        console.log(`✅ Fetched ${fetchedCalculations.length} salary calculations`);
        
        // Deduplicate calculations on frontend as a safety measure
        // Keep only the most recent calculation for each unique period
        const seenPeriods = new Map<string, SalaryCalculation>();
        const deduplicatedCalculations: SalaryCalculation[] = [];
        
        // Helper function to normalize dates for comparison
        const normalizeDate = (date: string | Date | undefined): string => {
          if (!date) return '';
          try {
            const d = typeof date === 'string' ? new Date(date) : date;
            // Check if date is valid
            if (isNaN(d.getTime())) {
              console.warn(`⚠️ Invalid date encountered: ${date}`);
              return '';
            }
            return d.toISOString().split('T')[0]; // Get YYYY-MM-DD format
          } catch (error) {
            console.warn(`⚠️ Error normalizing date ${date}:`, error);
            return '';
          }
        };
        
        console.log(`🔍 Starting deduplication for ${fetchedCalculations.length} calculations`);
        
        for (const calc of fetchedCalculations) {
          // Normalize dates to ensure consistent comparison
          const startDate = normalizeDate(calc.calculationPeriod?.startDate);
          const endDate = normalizeDate(calc.calculationPeriod?.endDate);
          
          // Create period key - use ID as fallback if dates are invalid
          let periodKey: string;
          if (startDate && endDate) {
            periodKey = `${calc.driverId}-${startDate}-${endDate}`;
          } else {
            // Fallback: use materialId and period type if dates are invalid
            periodKey = `${calc.driverId}-${calc.materialId}-${calc.calculationPeriod?.periodType || 'UNKNOWN'}`;
            console.warn(`⚠️ Using fallback periodKey for calculation ${calc.id} due to invalid dates`);
          }
          
          console.log(`📋 Processing calculation ${calc.id}: periodKey=${periodKey}, startDate=${startDate || 'INVALID'}, endDate=${endDate || 'INVALID'}`);
          
          if (!seenPeriods.has(periodKey)) {
            seenPeriods.set(periodKey, calc);
            deduplicatedCalculations.push(calc);
            console.log(`✅ Added new calculation for period: ${periodKey}`);
          } else {
            // Duplicate period found - keep the one with the most recent createdAt
            const existing = seenPeriods.get(periodKey)!;
            const existingDate = existing.createdAt ? new Date(existing.createdAt) : new Date(0);
            const currentDate = calc.createdAt ? new Date(calc.createdAt) : new Date(0);
            
            // Validate dates before comparison
            const existingValid = !isNaN(existingDate.getTime());
            const currentValid = !isNaN(currentDate.getTime());
            
            console.log(`⚠️ Duplicate found! Existing: ${existing.id} (${existing.createdAt || 'INVALID'}), Current: ${calc.id} (${calc.createdAt || 'INVALID'})`);
            
            // If both dates are valid, compare them. Otherwise, prefer the one with a valid date, or keep existing
            if (currentValid && existingValid && currentDate > existingDate) {
              // Replace with newer calculation
              const index = deduplicatedCalculations.indexOf(existing);
              if (index !== -1) {
                deduplicatedCalculations[index] = calc;
                seenPeriods.set(periodKey, calc);
                console.log(`🔄 Replaced with newer calculation: ${calc.id}`);
              }
            } else if (currentValid && !existingValid) {
              // Current has valid date, existing doesn't - replace
              const index = deduplicatedCalculations.indexOf(existing);
              if (index !== -1) {
                deduplicatedCalculations[index] = calc;
                seenPeriods.set(periodKey, calc);
                console.log(`🔄 Replaced (current has valid date): ${calc.id}`);
              }
            } else {
              console.log(`⏭️ Keeping existing calculation: ${existing.id}`);
            }
          }
        }
        
        // Sort by start date descending (most recent first)
        deduplicatedCalculations.sort((a, b) => {
          const dateA = new Date(a.calculationPeriod?.startDate || 0);
          const dateB = new Date(b.calculationPeriod?.startDate || 0);
          return dateB.getTime() - dateA.getTime();
        });
        
        if (fetchedCalculations.length !== deduplicatedCalculations.length) {
          console.log(`⚠️ Frontend deduplication: ${fetchedCalculations.length} → ${deduplicatedCalculations.length} calculations`);
        } else {
          console.log(`✅ No duplicates found (all ${deduplicatedCalculations.length} are unique)`);
        }
        
        setCalculations(deduplicatedCalculations);
      } else {
        console.warn('⚠️ getMySalaryCalculations returned success: false', calculationsData.data?.getMySalaryCalculations?.message);
        // Still set empty array to show empty state
        setCalculations([]);
      }

      // Fetch salary summary
      const summaryResponse = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
      });

      const summaryData = await summaryResponse.json();
      
      // Check for GraphQL errors
      if (summaryData.errors) {
        console.error('GraphQL errors in getMySalarySummary:', summaryData.errors);
        // Don't throw here, just log - summary is not critical
      }
      
      // Check response structure and success flag
      if (summaryData.data?.getMySalarySummary?.success) {
        setSummary(summaryData.data.getMySalarySummary.summary);
        console.log('✅ Fetched salary summary successfully');
      } else {
        console.warn('⚠️ getMySalarySummary returned success: false', summaryData.data?.getMySalarySummary?.message);
      }

    } catch (error) {
      console.error('Error fetching salary data:', error);
      Alert.alert('Error', 'Failed to fetch salary data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSalaryData(true);
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

  // Calculate current month's salary
  const getCurrentMonthSalary = () => {
    if (!calculations || calculations.length === 0) {
      return { totalSalary: 0, totalDistanceSalary: 0, totalHoursSalary: 0 };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentMonthCalculations = calculations.filter((calc) => {
      if (!calc.calculationPeriod?.startDate) return false;
      
      const startDate = new Date(calc.calculationPeriod.startDate);
      const calcMonth = startDate.getMonth();
      const calcYear = startDate.getFullYear();
      
      // Check if the calculation period is in the current month
      return calcMonth === currentMonth && calcYear === currentYear;
    });

    const totalSalary = currentMonthCalculations.reduce((sum, calc) => {
      return sum + (calc.calculations?.totalSalary || 0);
    }, 0);

    const totalDistanceSalary = currentMonthCalculations.reduce((sum, calc) => {
      return sum + (calc.calculations?.distanceComputation || 0);
    }, 0);

    const totalHoursSalary = currentMonthCalculations.reduce((sum, calc) => {
      return sum + (calc.calculations?.hoursComputation || 0);
    }, 0);

    return {
      totalSalary: Math.round(totalSalary * 100) / 100,
      totalDistanceSalary: Math.round(totalDistanceSalary * 100) / 100,
      totalHoursSalary: Math.round(totalHoursSalary * 100) / 100,
    };
  };

  const fetchDailyBreakdown = async (calculation: SalaryCalculation) => {
    console.log('🚀 fetchDailyBreakdown called with calculation:', calculation.id);
    try {
      setLoadingBreakdown(true);
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

        console.log('🔍 Parsing dates for daily breakdown:', { 
          startDateValue, 
          endDateValue,
          startDateType: typeof startDateValue,
          endDateType: typeof endDateValue
        });

        if (!startDateValue || !endDateValue) {
          throw new Error('Missing date values in calculation period');
        }

        // Try to parse the date - handle both string and number timestamps
        let startDateParsed: Date;
        let endDateParsed: Date;

        // Handle string timestamps (like '1761955200000')
        if (typeof startDateValue === 'string') {
          // Check if it's a numeric string (timestamp)
          if (/^\d+$/.test(startDateValue)) {
            const timestamp = parseInt(startDateValue, 10);
            startDateParsed = new Date(timestamp);
            console.log(`📅 Parsed start date from timestamp: ${timestamp} → ${startDateParsed.toISOString()}`);
          } else {
            // It's an ISO string or other date format
            startDateParsed = new Date(startDateValue);
            console.log(`📅 Parsed start date from string: ${startDateValue} → ${startDateParsed.toISOString()}`);
          }
        } else if (typeof startDateValue === 'number') {
          startDateParsed = new Date(startDateValue);
          console.log(`📅 Parsed start date from number: ${startDateValue} → ${startDateParsed.toISOString()}`);
        } else {
          startDateParsed = new Date(startDateValue);
          console.log(`📅 Parsed start date from other: ${startDateValue} → ${startDateParsed.toISOString()}`);
        }

        if (typeof endDateValue === 'string') {
          // Check if it's a numeric string (timestamp)
          if (/^\d+$/.test(endDateValue)) {
            const timestamp = parseInt(endDateValue, 10);
            endDateParsed = new Date(timestamp);
            console.log(`📅 Parsed end date from timestamp: ${timestamp} → ${endDateParsed.toISOString()}`);
          } else {
            // It's an ISO string or other date format
            endDateParsed = new Date(endDateValue);
            console.log(`📅 Parsed end date from string: ${endDateValue} → ${endDateParsed.toISOString()}`);
          }
        } else if (typeof endDateValue === 'number') {
          endDateParsed = new Date(endDateValue);
          console.log(`📅 Parsed end date from number: ${endDateValue} → ${endDateParsed.toISOString()}`);
        } else {
          endDateParsed = new Date(endDateValue);
          console.log(`📅 Parsed end date from other: ${endDateValue} → ${endDateParsed.toISOString()}`);
        }

        // Validate dates
        if (isNaN(startDateParsed.getTime())) {
          throw new Error(`Invalid start date: ${startDateValue} (parsed as: ${startDateParsed})`);
        }
        if (isNaN(endDateParsed.getTime())) {
          throw new Error(`Invalid end date: ${endDateValue} (parsed as: ${endDateParsed})`);
        }

        startDate = new Date(startDateParsed);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endDateParsed);
        endDate.setHours(23, 59, 59, 999);

        console.log(`✅ Final dates: start=${startDate.toISOString()}, end=${endDate.toISOString()}`);

        // Double-check dates are still valid after manipulation
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Date manipulation resulted in invalid dates');
        }
      } catch (dateError) {
        console.error('❌ Error parsing dates for daily breakdown:', dateError);
        console.error('Calculation period:', calculation.calculationPeriod);
        setDailyBreakdown([]);
        setLoadingBreakdown(false);
        return;
      }

      const apiUrl = `${API_CONFIG.BASE_URL}/screenTracking/driver/${calculation.driverId}?period=daily&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      console.log(`🌐 Fetching daily breakdown from: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch daily breakdown: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Daily breakdown API response:', JSON.stringify(data, null, 2));
      
      // The API returns { success: true, data: { dailyData: { dailyBreakdown: [...] } } }
      // So we need to access data.data.dailyData.dailyBreakdown
      const dailyData = data.data?.dailyData?.dailyBreakdown || data.dailyData?.dailyBreakdown || [];
      console.log(`📋 Found ${dailyData.length} days of data`);
      console.log('📋 Daily data sample:', dailyData.slice(0, 2));
      
      if (dailyData.length === 0) {
        console.warn('⚠️ No daily breakdown data in API response');
        console.warn('Response keys:', Object.keys(data));
        if (data.data) {
          console.warn('data.data keys:', Object.keys(data.data));
          if (data.data.dailyData) {
            console.warn('data.data.dailyData keys:', Object.keys(data.data.dailyData));
          }
        }
        if (data.dailyData) {
          console.warn('data.dailyData keys:', Object.keys(data.dailyData));
        }
      }
      
      // Calculate daily salary for each day
      const breakdown: DailyBreakdown[] = dailyData.map((day: any) => {
        const distance = day.totalDistance || 0;
        const hours = day.totalHours || 0;
        const distanceRate = calculation.pricingConfig?.distanceRate || 0;
        const hoursRate = calculation.pricingConfig?.hoursRate || 0;
        
        const distanceSalary = distance * distanceRate;
        const hoursSalary = hours * hoursRate;
        const dailySalary = distanceSalary + hoursSalary;
        
        return {
          date: day.date,
          totalDistance: distance,
          totalHours: hours,
          distanceSalary: Math.round(distanceSalary * 100) / 100,
          hoursSalary: Math.round(hoursSalary * 100) / 100,
          dailySalary: Math.round(dailySalary * 100) / 100,
        };
      });

      // Sort by date (oldest first) - with validation
      breakdown.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        // Skip invalid dates in sorting
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`✅ Processed ${breakdown.length} days for daily breakdown`);
      setDailyBreakdown(breakdown);
    } catch (error) {
      console.error('❌ Error fetching daily breakdown:', error);
      setDailyBreakdown([]);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleViewDetails = async (calculation: SalaryCalculation) => {
    setSelectedCalculation(calculation);
    setModalVisible(true);
    // Fetch daily breakdown when modal opens
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

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItemCard}>
              <Text style={styles.summaryValue}>
                {formatCurrency(getCurrentMonthSalary().totalDistanceSalary)}
              </Text>
              <Text style={styles.summaryLabel}>Distance Salary</Text>
            </View>
            <View style={styles.summaryItemCard}>
              <Text style={styles.summaryValue}>
                {formatCurrency(getCurrentMonthSalary().totalHoursSalary)}
              </Text>
              <Text style={styles.summaryLabel}>Hours Salary</Text>
            </View>
            <View style={styles.summaryItemCard}>
              <Text style={styles.summaryValue}>{formatCurrency(getCurrentMonthSalary().totalSalary)}</Text>
              <Text style={styles.summaryLabel}>Total Salary (This Month)</Text> 
            </View>
          </View>
        </View>

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
                    <Text style={styles.detailValue}>{calculation.rawData?.totalDistance || 0} km</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hours:</Text>
                    <Text style={styles.detailValue}>{calculation.rawData?.totalHours || 0} hrs</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Salary:</Text>
                    <Text style={styles.totalSalary}>{formatCurrency(calculation.calculations?.totalSalary || 0)}</Text>
                  </View>
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
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Salary Calculation Details</Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setDailyBreakdown([]);
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
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

              {/* Raw Data */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Raw Data</Text>
                <View style={styles.rawDataGrid}>
                  <View style={styles.rawDataItemCard}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData?.totalDistance || 0}</Text>
                    <Text style={styles.rawDataLabel}>Total Distance</Text>
                  </View>
                  <View style={styles.rawDataItemCard}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData?.totalHours || 0}</Text>
                    <Text style={styles.rawDataLabel}>Total Hours</Text>
                  </View>
                  <View style={styles.rawDataItemCard}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData?.daysWorked || 0}</Text>
                    <Text style={styles.rawDataLabel}>Days Worked</Text>
                  </View>
                </View>
              </View>

              {/* Calculations */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Salary Calculations</Text>
                <View style={styles.calculationGrid}>
                  <View style={styles.calculationRow}>
                    <View style={styles.calculationItem}>
                      <Text style={styles.calculationValue}>
                        {formatCurrency(selectedCalculation.calculations?.distanceComputation || 0)}
                      </Text>
                      <Text style={styles.calculationLabel}>Distance Computation</Text>
                      <Text style={styles.calculationFormula}>
                        {selectedCalculation.rawData?.totalDistance || 0} km × {formatCurrency(selectedCalculation.pricingConfig?.distanceRate || 0)}/km
                      </Text>
                    </View>
                    <View style={styles.calculationItem}>
                      <Text style={styles.calculationValue}>
                        {formatCurrency(selectedCalculation.calculations?.hoursComputation || 0)}
                      </Text>
                      <Text style={styles.calculationLabel}>Hours Computation</Text>
                      <Text style={styles.calculationFormula}>
                        {selectedCalculation.rawData?.totalHours || 0} hrs × {formatCurrency(selectedCalculation.pricingConfig?.hoursRate || 0)}/hour
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.calculationItem, styles.totalCalculationItem]}>
                    <Text style={styles.totalCalculationValue}>
                      {formatCurrency(selectedCalculation.calculations?.totalSalary || 0)}
                    </Text>
                    <Text style={styles.totalCalculationLabel}>Total Salary</Text>
                    <Text style={styles.totalCalculationFormula}>
                      Distance + Hours Computation
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
                              {day.totalDistance.toFixed(2)} km
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
                              {day.totalHours.toFixed(2)} hrs
                            </Text>
                            <Text style={[
                              styles.dailyBreakdownSalary,
                              day.hoursSalary > 1 ? styles.dailyBreakdownSalaryGreen : styles.dailyBreakdownSalaryZero
                            ]}>
                              {formatCurrency(day.hoursSalary)}
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

              {selectedCalculation.notes && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Notes</Text>
                  <Text style={styles.notesText}>{selectedCalculation.notes}</Text>
                </View>
              )}
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
  notesText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
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
});

export default SalaryScreen;
