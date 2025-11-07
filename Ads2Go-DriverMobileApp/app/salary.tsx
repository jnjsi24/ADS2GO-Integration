import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const SalaryScreen: React.FC = () => {
  const [calculations, setCalculations] = useState<SalaryCalculation[]>([]);
  const [summary, setSummary] = useState<SalarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<SalaryCalculation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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
        setCalculations(fetchedCalculations);
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
        return 'calculator-outline';
      case 'approved':
        return 'checkmark-circle-outline';
      case 'paid':
        return 'cash-outline';
      case 'disputed':
        return 'alert-circle-outline';
      default:
        return 'time-outline';
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

  const handleViewDetails = (calculation: SalaryCalculation) => {
    setSelectedCalculation(calculation);
    setModalVisible(true);
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Salary</Text>
        </View>

        {/* Summary Card */}
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Salary Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Distance Salary</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(summary.totalDistanceSalary || 0)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Hours Salary</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(summary.totalHoursSalary || 0)}
                </Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Earnings</Text>
                <Text style={styles.summaryValue}>{formatCurrency(summary.totalSalary)}</Text>
              </View>
            </View>
          </View>
        )}

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
                    <Text style={styles.calculationPeriod}>{calculation.periodDisplay}</Text>
                    <Text style={styles.calculationType}>{calculation.calculationPeriod.periodType}</Text>
                  </View>
                  <View style={styles.calculationStatus}>
                    <Ionicons
                      name={getStatusIcon(calculation.status)}
                      size={20}
                      color={getStatusColor(calculation.status)}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(calculation.status) }]}>
                      {calculation.status}
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
                    <Text style={styles.detailValue}>{calculation.rawData.totalDistance} km</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hours:</Text>
                    <Text style={styles.detailValue}>{calculation.rawData.totalHours} hrs</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Salary:</Text>
                    <Text style={styles.totalSalary}>{formatCurrency(calculation.calculations.totalSalary)}</Text>
                  </View>
                </View>
                
                <View style={styles.calculationFooter}>
                  <Text style={styles.footerText}>
                    Created: {formatDate(calculation.createdAt)}
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
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Salary Calculation Details</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
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
                  <Text style={styles.detailValue}>{selectedCalculation.periodDisplay}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.calculationPeriod.periodType}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Days Worked:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.rawData.daysWorked} days</Text>
                </View>
              </View>

              {/* Material Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Material Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Material Type:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.material.materialType}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.material.category}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehicle Type:</Text>
                  <Text style={styles.detailValue}>{selectedCalculation.material.vehicleType}</Text>
                </View>
              </View>

              {/* Raw Data */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Raw Data</Text>
                <View style={styles.rawDataGrid}>
                  <View style={styles.rawDataItem}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData.totalDistance}</Text>
                    <Text style={styles.rawDataLabel}>Total Distance (km)</Text>
                  </View>
                  <View style={styles.rawDataItem}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData.totalHours}</Text>
                    <Text style={styles.rawDataLabel}>Total Hours</Text>
                  </View>
                  <View style={styles.rawDataItem}>
                    <Text style={styles.rawDataValue}>{selectedCalculation.rawData.daysWorked}</Text>
                    <Text style={styles.rawDataLabel}>Days Worked</Text>
                  </View>
                </View>
              </View>

              {/* Pricing Configuration */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Pricing Configuration</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Distance Rate:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedCalculation.pricingConfig.distanceRate)}/km
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Hours Rate:</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(selectedCalculation.pricingConfig.hoursRate)}/hour
                  </Text>
                </View>
              </View>

              {/* Calculations */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Salary Calculations</Text>
                <View style={styles.calculationGrid}>
                  <View style={styles.calculationItem}>
                    <Text style={styles.calculationValue}>
                      {formatCurrency(selectedCalculation.calculations.distanceComputation)}
                    </Text>
                    <Text style={styles.calculationLabel}>Distance Computation</Text>
                    <Text style={styles.calculationFormula}>
                      {selectedCalculation.rawData.totalDistance} km × {formatCurrency(selectedCalculation.pricingConfig.distanceRate)}/km
                    </Text>
                  </View>
                  <View style={styles.calculationItem}>
                    <Text style={styles.calculationValue}>
                      {formatCurrency(selectedCalculation.calculations.hoursComputation)}
                    </Text>
                    <Text style={styles.calculationLabel}>Hours Computation</Text>
                    <Text style={styles.calculationFormula}>
                      {selectedCalculation.rawData.totalHours} hrs × {formatCurrency(selectedCalculation.pricingConfig.hoursRate)}/hour
                    </Text>
                  </View>
                  <View style={[styles.calculationItem, styles.totalCalculationItem]}>
                    <Text style={styles.totalCalculationValue}>
                      {formatCurrency(selectedCalculation.calculations.totalSalary)}
                    </Text>
                    <Text style={styles.totalCalculationLabel}>Total Salary</Text>
                    <Text style={styles.totalCalculationFormula}>
                      Distance + Hours Computation
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Status Information</Text>
                <View style={styles.statusContainer}>
                  <Ionicons
                    name={getStatusIcon(selectedCalculation.status)}
                    size={24}
                    color={getStatusColor(selectedCalculation.status)}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(selectedCalculation.status) }]}>
                    {selectedCalculation.status}
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
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  summaryCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#3674B5',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    padding: 20,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  },
  rawDataItem: {
    alignItems: 'center',
    flex: 1,
  },
  rawDataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  rawDataLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  calculationGrid: {
    gap: 12,
  },
  calculationItem: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  totalCalculationItem: {
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
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
    color: '#059669',
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
});

export default SalaryScreen;
