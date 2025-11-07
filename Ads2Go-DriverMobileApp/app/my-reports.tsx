import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request } from 'graphql-request';
import { useRouter } from 'expo-router';
import API_CONFIG from '../config/api';
import { GET_DRIVER_REPORTS } from '../graphql/driverReports';
import { useFocusEffect } from '@react-navigation/native';

interface AdminInfo {
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
}

interface Report {
  id: string;
  driverId: string;
  title: string;
  description: string;
  reportType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  attachments: string[];
  adminNotes?: string;
  adminNotesUpdatedAt?: string;
  adminNotesBy?: AdminInfo;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const STATUS_COLORS = {
  PENDING: { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  IN_PROGRESS: { bg: '#dbeafe', text: '#1e40af', border: '#3674B5' },
  RESOLVED: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
  CLOSED: { bg: '#e5e7eb', text: '#374151', border: '#9ca3af' },
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  BUG: 'Bug / Technical Issue',
  PAYMENT: 'Payment Issue',
  ACCOUNT: 'Account Issue',
  VEHICLE_ISSUE: 'Vehicle Issue',
  MATERIAL_ISSUE: 'Material Issue',
  APP_ISSUE: 'App Issue',
  REQUEST_ACCOUNT_CLOSURE: 'Account Closure Request',
  UPDATE_PROFILE_DETAILS: 'Profile Update Request',
  OTHER: 'Other',
};

export default function MyReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Load reports when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [])
  );

  const loadReports = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const filters: any = {};
      if (statusFilter !== 'ALL') {
        filters.status = statusFilter;
      }

      const result: any = await request(
        API_CONFIG.API_URL,
        GET_DRIVER_REPORTS,
        { filters, limit: 100, offset: 0 },
        { Authorization: `Bearer ${token}` }
      );

      if (result.getDriverReports?.success) {
        setReports(result.getDriverReports.reports || []);
      } else {
        Alert.alert('Error', result.getDriverReports?.message || 'Failed to load reports');
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PENDING;
  };

  const openReportDetails = (report: Report) => {
    setSelectedReport(report);
    setDetailsModalVisible(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalVisible(false);
    setSelectedReport(null);
  };

  const filteredReports = statusFilter === 'ALL' 
    ? reports 
    : reports.filter(report => report.status === statusFilter);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Reports</Text>
            <View style={styles.placeholder} />
          </View>
          <Text style={styles.headerSubtitle}>
            {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
          </Text>
        </View>

        {/* Status Filter */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  statusFilter === status && styles.filterButtonActive,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    statusFilter === status && styles.filterButtonTextActive,
                  ]}
                >
                  {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Reports List */}
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredReports.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyStateTitle}>No Reports Found</Text>
              <Text style={styles.emptyStateText}>
                {statusFilter === 'ALL'
                  ? 'You haven\'t submitted any reports yet.'
                  : `No reports with status: ${statusFilter}`}
              </Text>
            </View>
          ) : (
            filteredReports.map((report) => {
              const statusColor = getStatusColor(report.status);
              return (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportCard}
                  onPress={() => openReportDetails(report)}
                  activeOpacity={0.7}
                >
                  <View style={styles.reportCardHeader}>
                    <View style={styles.reportCardTitleContainer}>
                      <Text style={styles.reportCardTitle} numberOfLines={1}>
                        {report.title}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusColor.bg, borderColor: statusColor.border },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: statusColor.text }]}>
                          {report.status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                  </View>

                  <Text style={styles.reportCardType}>
                    {REPORT_TYPE_LABELS[report.reportType] || report.reportType}
                  </Text>

                  <Text style={styles.reportCardDescription} numberOfLines={2}>
                    {report.reportType === 'UPDATE_PROFILE_DETAILS' 
                      ? (() => {
                          try {
                            const data = JSON.parse(report.description);
                            const fieldCount = data.changes?.length || 0;
                            return `Requesting to update ${fieldCount} field${fieldCount !== 1 ? 's' : ''}`;
                          } catch {
                            return report.description;
                          }
                        })()
                      : report.description}
                  </Text>

                  {report.adminNotes && (
                    <View style={styles.adminNotesPreview}>
                      <Ionicons name="chatbox-ellipses" size={16} color="#3674B5" />
                      <Text style={styles.adminNotesPreviewText} numberOfLines={1}>
                        Admin responded
                      </Text>
                    </View>
                  )}

                  <View style={styles.reportCardFooter}>
                    <View style={styles.footerItem}>
                      <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
                      <Text style={styles.footerText}>{formatDate(report.createdAt)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>

      {/* Report Details Modal */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeDetailsModal}
      >
        {selectedReport && (
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeDetailsModal} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#1f2937" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Report Details</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Status Badge */}
              <View
                style={[
                  styles.modalStatusBadge,
                  {
                    backgroundColor: getStatusColor(selectedReport.status).bg,
                    borderColor: getStatusColor(selectedReport.status).border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalStatusText,
                    { color: getStatusColor(selectedReport.status).text },
                  ]}
                >
                  {selectedReport.status.replace('_', ' ')}
                </Text>
              </View>

              {/* Title */}
              <Text style={styles.modalTitle}>{selectedReport.title}</Text>

              {/* Type */}
              <View style={styles.modalInfoRow}>
                <Ionicons name="pricetag-outline" size={20} color="#6b7280" />
                <Text style={styles.modalInfoLabel}>Category:</Text>
                <Text style={styles.modalInfoValue}>
                  {REPORT_TYPE_LABELS[selectedReport.reportType] || selectedReport.reportType}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>
                  {selectedReport.reportType === 'UPDATE_PROFILE_DETAILS' ? 'Requested Changes' : 'Description'}
                </Text>
                {selectedReport.reportType === 'UPDATE_PROFILE_DETAILS' ? (
                  (() => {
                    try {
                      const data = JSON.parse(selectedReport.description);
                      return (
                        <View>
                          {data.changes?.map((change: any, index: number) => (
                            <View key={index} style={styles.changeItem}>
                              <Text style={styles.changeFieldLabel}>{change.fieldLabel}</Text>
                              <View style={styles.changeValues}>
                                <View style={styles.changeValueContainer}>
                                  <Text style={styles.changeValueLabel}>Current:</Text>
                                  <Text style={styles.changeCurrentValue}>{change.currentValue || 'N/A'}</Text>
                                </View>
                                <Ionicons name="arrow-forward" size={16} color="#3674B5" style={styles.changeArrow} />
                                <View style={styles.changeValueContainer}>
                                  <Text style={styles.changeValueLabel}>New:</Text>
                                  <Text style={styles.changeNewValue}>{change.newValue || 'N/A'}</Text>
                                </View>
                              </View>
                              {change.hasAttachment && (
                                <View style={styles.attachmentIndicator}>
                                  <Ionicons name="attach" size={14} color="#6b7280" />
                                  <Text style={styles.attachmentText}>Document attached</Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      );
                    } catch {
                      return <Text style={styles.modalSectionContent}>{selectedReport.description}</Text>;
                    }
                  })()
                ) : (
                  <Text style={styles.modalSectionContent}>{selectedReport.description}</Text>
                )}
              </View>

              {/* Admin Notes */}
              {selectedReport.adminNotes && (
                <View style={styles.modalSection}>
                  <View style={styles.adminNotesHeader}>
                    <Text style={styles.modalSectionTitle}>Admin Response</Text>
                    {selectedReport.adminNotesUpdatedAt && (
                      <Text style={styles.adminNotesTimestamp}>
                        {formatDate(selectedReport.adminNotesUpdatedAt)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.adminNotesBox}>
                    <Text style={styles.adminNotesContent}>{selectedReport.adminNotes}</Text>
                  </View>
                  <Text style={styles.adminNotesByText}>
                    Response by: Admin
                  </Text>
                </View>
              )}

              {/* Timestamps */}
              <View style={styles.timestampsContainer}>
                <View style={styles.timestampRow}>
                  <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                  <View style={styles.timestampContent}>
                    <Text style={styles.timestampLabel}>Submitted</Text>
                    <Text style={styles.timestampValue}>{formatDate(selectedReport.createdAt)}</Text>
                  </View>
                </View>

                <View style={styles.timestampRow}>
                  <Ionicons name="sync-outline" size={18} color="#6b7280" />
                  <View style={styles.timestampContent}>
                    <Text style={styles.timestampLabel}>Last Updated</Text>
                    <Text style={styles.timestampValue}>{formatDate(selectedReport.updatedAt)}</Text>
                  </View>
                </View>

                {selectedReport.resolvedAt && (
                  <View style={styles.timestampRow}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
                    <View style={styles.timestampContent}>
                      <Text style={styles.timestampLabel}>Resolved</Text>
                      <Text style={styles.timestampValue}>{formatDate(selectedReport.resolvedAt)}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Report ID */}
              <Text style={styles.reportId}>Report ID: {selectedReport.id.slice(0, 8)}...</Text>

              <View style={styles.bottomSpacing} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </>
  );
}

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
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#3674B5',
    borderColor: '#3674B5',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  reportCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reportCardTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reportCardType: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  reportCardDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  adminNotesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  adminNotesPreviewText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
  },
  reportCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  bottomSpacing: {
    height: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 16,
  },
  modalStatusText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    lineHeight: 32,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalSectionContent: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },
  adminNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adminNotesTimestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  adminNotesBox: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3674B5',
    padding: 16,
    borderRadius: 8,
  },
  adminNotesContent: {
    fontSize: 15,
    color: '#1e40af',
    lineHeight: 22,
  },
  adminNotesByText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  timestampsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
  },
  timestampContent: {
    flex: 1,
  },
  timestampLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  timestampValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  reportId: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  changeItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  changeFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeValueContainer: {
    flex: 1,
  },
  changeValueLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  changeCurrentValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  changeNewValue: {
    fontSize: 14,
    color: '#3674B5',
    fontWeight: '600',
  },
  changeArrow: {
    marginHorizontal: 12,
  },
  attachmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  attachmentText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
    fontStyle: 'italic',
  },
});

