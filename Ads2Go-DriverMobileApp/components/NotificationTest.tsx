import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import NotificationService from '../services/notificationService';

export default function NotificationTest() {
  const notificationService = NotificationService.getInstance();

  const testImmediateNotification = async () => {
    await notificationService.showLocalNotification(
      'Test Notification',
      'This is a test local notification that works in Expo Go!',
      { category: 'TEST', priority: 'LOW' }
    );
  };

  const testMaterialAssignment = async () => {
    await notificationService.showMaterialAssignmentNotification(
      'Test Material',
      'test-material-123'
    );
  };

  const testDriverStatus = async () => {
    await notificationService.showDriverStatusNotification(
      'Your driver status has been updated to Active'
    );
  };

  const testRouteUpdate = async () => {
    await notificationService.showRouteUpdateNotification(
      'Your route has been updated with new stops'
    );
  };

  const testScheduledNotification = async () => {
    await notificationService.scheduleLocalNotification(
      'Scheduled Notification',
      'This notification was scheduled 5 seconds ago',
      5,
      { category: 'SCHEDULED', priority: 'MEDIUM' }
    );
    Alert.alert('Scheduled', 'Notification will appear in 5 seconds');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Notification Test (Expo Go Compatible)</ThemedText>
      <ThemedText style={styles.subtitle}>
        These local notifications work in Expo Go SDK 54+
      </ThemedText>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testImmediateNotification}>
          <ThemedText style={styles.buttonText}>Test Immediate Notification</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testMaterialAssignment}>
          <ThemedText style={styles.buttonText}>Test Material Assignment</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testDriverStatus}>
          <ThemedText style={styles.buttonText}>Test Driver Status</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testRouteUpdate}>
          <ThemedText style={styles.buttonText}>Test Route Update</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testScheduledNotification}>
          <ThemedText style={styles.buttonText}>Test Scheduled (5s delay)</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.7,
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
