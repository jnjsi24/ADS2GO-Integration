import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../../config/api';
// Use safe notification service that works in Expo Go
import SafeNotificationService from '../../services/safeNotificationService';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  read: boolean;
  readAt?: string;
  createdAt: string;
  data?: any;
}

const GET_DRIVER_NOTIFICATIONS = `
  query GetDriverNotifications($driverId: ID!) {
    getDriverNotifications(driverId: $driverId) {
      notifications {
        id
        title
        message
        type
        category
        priority
        read
        readAt
        createdAt
        data
      }
      unreadCount
    }
  }
`;

const MARK_NOTIFICATION_READ = `
  mutation MarkNotificationRead($notificationId: ID!) {
    markNotificationRead(notificationId: $notificationId) {
      success
      message
    }
  }
`;

const MARK_ALL_NOTIFICATIONS_READ = `
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead {
      success
      message
    }
  }
`;

const DELETE_NOTIFICATION = `
  mutation DeleteNotification($notificationId: ID!) {
    deleteNotification(notificationId: $notificationId) {
      success
      message
    }
  }
`;

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const driverId = await AsyncStorage.getItem('driverId');

      if (!token || !driverId) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: GET_DRIVER_NOTIFICATIONS,
          variables: { driverId },
        }),
      });

      const result = await response.json();

      if (result.data?.getDriverNotifications) {
        const notificationData = result.data.getDriverNotifications;
        const fetchedNotifications = notificationData.notifications || [];
        setNotifications(fetchedNotifications);
        
        // Calculate unread count from the API response or count manually as fallback
        const apiUnreadCount = notificationData.unreadCount ?? 0;
        const calculatedUnreadCount = fetchedNotifications.filter((n: Notification) => !n.read).length;
        const finalUnreadCount = apiUnreadCount > 0 ? apiUnreadCount : calculatedUnreadCount;
        
        console.log('📊 Notification stats:', {
          total: fetchedNotifications.length,
          apiUnreadCount,
          calculatedUnreadCount,
          finalUnreadCount
        });
        
        setUnreadCount(finalUnreadCount);
      } else {
        console.error('Failed to load notifications:', result.errors);
        Alert.alert('Error', 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');

      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: MARK_NOTIFICATION_READ,
          variables: { notificationId },
        }),
      });

      const result = await response.json();

      if (result.data?.markNotificationRead?.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true, readAt: new Date().toISOString() }
              : notification
          )
        );
        setUnreadCount(prev => {
          const newCount = Math.max(0, prev - 1);
          console.log('📉 Unread count updated:', prev, '->', newCount);
          return newCount;
        });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      console.log('🔔 Marking all notifications as read...');

      const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: MARK_ALL_NOTIFICATIONS_READ,
        }),
      });

      const result = await response.json();
      console.log('📥 Mark all as read response:', result);

      if (result.data?.markAllNotificationsRead?.success) {
        // Update local state
        setNotifications(prev =>
          prev.map(notification => ({
            ...notification,
            read: true,
            readAt: new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
        Alert.alert('Success', 'All notifications marked as read');
      } else {
        const errorMessage = result.errors?.[0]?.message || result.data?.markAllNotificationsRead?.message || 'Unknown error';
        console.error('❌ Failed to mark all as read:', errorMessage);
        Alert.alert('Error', `Failed to mark notifications as read: ${errorMessage}`);
      }
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read. Please try again.');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Selection', 'Please select notifications to delete');
      return;
    }

    Alert.alert(
      'Delete Notifications',
      `Are you sure you want to delete ${selectedIds.size} notification(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');

              if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
              }

              console.log('🗑️ Deleting notifications:', Array.from(selectedIds));

              const deletePromises = Array.from(selectedIds).map(async id => {
                const response = await fetch(`${API_CONFIG.BASE_URL}/graphql`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    query: DELETE_NOTIFICATION,
                    variables: { notificationId: id },
                  }),
                });
                const result = await response.json();
                console.log(`📥 Delete response for ${id}:`, result);
                return result;
              });

              const results = await Promise.all(deletePromises);

              // Check if any deletions failed
              const failures = results.filter(r => !r.data?.deleteNotification?.success);
              if (failures.length > 0) {
                console.error('❌ Some deletions failed:', failures);
              }

              // Count how many were unread before deleting
              const unreadCount = notifications.filter(n => selectedIds.has(n.id) && !n.read).length;

              // Update local state
              setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
              setUnreadCount(prev => Math.max(0, prev - unreadCount));
              setSelectedIds(new Set());
              setSelectionMode(false);

              if (failures.length === 0) {
                Alert.alert('Success', 'Notifications deleted successfully');
              } else {
                Alert.alert('Partial Success', `${results.length - failures.length} notifications deleted, ${failures.length} failed`);
              }
            } catch (error) {
              console.error('❌ Error deleting notifications:', error);
              Alert.alert('Error', 'Failed to delete notifications. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getNotificationIcon = (category: string, type: string) => {
    switch (category) {
      case 'MATERIAL_ASSIGNMENT':
        return 'cube-outline';
      case 'DRIVER_STATUS_CHANGE':
        return 'person-outline';
      case 'ROUTE_UPDATE':
        return 'map-outline';
      case 'DEVICE_ISSUE':
        return 'warning-outline';
      case 'REPORT_STATUS_UPDATE':
        return 'document-text-outline';
      case 'MATERIAL_STATUS_CHANGE':
        return 'radio-outline';
      case 'HOURS_MILESTONE':
        return 'trophy-outline';
      case 'MONTHLY_PHOTO_DUE_REMINDER':
        return 'calendar-outline';
      case 'MONTHLY_PHOTO_APPROVED':
        return 'checkmark-circle-outline';
      case 'MONTHLY_PHOTO_REJECTED':
        return 'close-circle-outline';
      default:
        return type === 'SUCCESS' ? 'checkmark-circle-outline' : 'information-circle-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return '#10B981';
      case 'ERROR':
        return '#EF4444';
      case 'WARNING':
        return '#F59E0B';
      case 'INFO':
      default:
        return '#3B82F6';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const testLocalNotification = async () => {
    try {
      const notificationService = SafeNotificationService.getInstance();
      await notificationService.showLocalNotification(
        'Test Notification',
        'This is a test local notification from the notifications page!',
        { category: 'TEST', priority: 'LOW' }
      );
    } catch (error) {
      console.error('Error showing test notification:', error);
      Alert.alert('Error', 'Failed to show test notification');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3674B5" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
        <View style={styles.loadingDotsContainer}>
          <View style={[styles.loadingDot, styles.loadingDot1]} />
          <View style={[styles.loadingDot, styles.loadingDot2]} />
          <View style={[styles.loadingDot, styles.loadingDot3]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.subtitleContainer}>
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
              <Text style={styles.subtitle}>
                unread notification{unreadCount > 1 ? 's' : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.subtitleAllRead}>All caught up! ✨</Text>
          )}
        </View>
        {notifications.length > 0 && !selectionMode && (
          <TouchableOpacity 
            style={styles.selectButton} 
            onPress={() => setSelectionMode(true)}
          >
            <Ionicons name="checkmark-done-outline" size={18} color="#ffffff" />
            <Text style={styles.selectButtonText}>Select</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons (shown in selection mode) */}
      {notifications.length > 0 && selectionMode && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.selectAllButton} 
            onPress={toggleSelectAll}
          >
            <Ionicons 
              name={selectedIds.size === notifications.length ? "checkbox" : "square-outline"} 
              size={18} 
              color="#ffffff" 
            />
            <Text style={styles.selectAllText}>
              {selectedIds.size === notifications.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>

          {selectedIds.size > 0 && (
            <TouchableOpacity 
              style={styles.deleteSelectedButton} 
              onPress={deleteSelected}
            >
              <Ionicons name="trash-outline" size={18} color="#ffffff" />
              <Text style={styles.deleteSelectedText}>Delete ({selectedIds.size})</Text>
            </TouchableOpacity>
          )}

          {unreadCount > 0 && (
            <TouchableOpacity 
              style={styles.markReadButton} 
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done-outline" size={18} color="#ffffff" />
              <Text style={styles.markReadText}>Mark all read</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyStateTitle}>No notifications</Text>
            <Text style={styles.emptyStateText}>
              You&apos;ll see notifications about material assignments, status updates, and more here.
            </Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={styles.notificationCard}
              onPress={() => {
                if (selectionMode) {
                  toggleSelection(notification.id);
                } else if (!notification.read) {
                  markAsRead(notification.id);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.notificationContent}>
                {selectionMode && (
                  <TouchableOpacity 
                    style={styles.checkboxContainer}
                    onPress={() => toggleSelection(notification.id)}
                  >
                    <Ionicons
                      name={selectedIds.has(notification.id) ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={selectedIds.has(notification.id) ? "#3B82F6" : "#9CA3AF"}
                    />
                  </TouchableOpacity>
                )}
                
                <View style={styles.textContainer}>
                  <View style={styles.headerRow}>
                    <Text style={[
                      styles.notificationTitle,
                      !notification.read && styles.unreadTitle
                    ]}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationDate}>
                      {formatDate(notification.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                </View>

                {!notification.read && !selectionMode && (
                  <View style={styles.unreadDot} />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  subtitleAllRead: {
    fontSize: 14,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  selectAllText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  deleteSelectedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  markReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    gap: 5,
  },
  markReadText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9CA3AF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  notificationDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginLeft: 8,
  },
});
