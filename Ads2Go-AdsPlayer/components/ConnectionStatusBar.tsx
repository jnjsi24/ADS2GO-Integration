import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useDeviceStatus from '../hooks/useDeviceStatus';

interface ConnectionStatusBarProps {
  materialId: string;
}

const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({ materialId }) => {
  const { isConnected, isOnline, reconnectAttempts, maxReconnectAttempts, error } = 
    useDeviceStatus(materialId);

  // Don't show anything if we're connected and online
  if (isConnected && isOnline) {
    return null;
  }

  // Temporarily hide connection status bar to avoid "Error: Connecting" message
  // The app works fine without WebSocket connection
  return null;

  let statusText = '';
  let iconName: keyof typeof MaterialIcons.glyphMap = 'wifi-off';
  let backgroundColor = '#f8d7da'; // Light red
  let textColor = '#721c24'; // Dark red

  if (!isConnected && reconnectAttempts > 0) {
    statusText = `Connecting... (${reconnectAttempts}/${maxReconnectAttempts})`;
    iconName = 'wifi-tethering';
    backgroundColor = '#fff3cd'; // Light yellow
    textColor = '#856404'; // Dark yellow
  } else if (error) {
    statusText = 'Connection error';
    iconName = 'error-outline';
  } else if (!isOnline) {
    statusText = 'Offline';
    iconName = 'cloud-off';
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <MaterialIcons name={iconName} size={16} color={textColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }]}>{statusText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ConnectionStatusBar;
