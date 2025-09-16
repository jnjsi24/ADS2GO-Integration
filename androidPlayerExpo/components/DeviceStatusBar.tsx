import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDeviceStatus } from '@/contexts/DeviceStatusContext';

export const DeviceStatusBar = () => {
  const { status, materialId } = useDeviceStatus();

  if (!materialId) {
    return null; // Don't show status bar if device is not registered
  }

  return (
    <View style={[styles.container, status.isOnline ? styles.online : styles.offline]}>
      <Text style={styles.text}>
        {status.isOnline ? 'ONLINE' : 'OFFLINE'}
      </Text>
      {status.error && (
        <Text style={styles.errorText} numberOfLines={1}>
          {status.error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  online: {
    backgroundColor: '#4CAF50', // Green
  },
  offline: {
    backgroundColor: '#F44336', // Red
  },
  text: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  errorText: {
    color: 'white',
    fontSize: 10,
    marginLeft: 8,
    maxWidth: 150,
  },
});
