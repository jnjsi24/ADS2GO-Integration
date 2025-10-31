import React from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle, TextStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useDeviceStatus } from '@/contexts/DeviceStatusContext';

type IconStyle = {
  marginRight: number;
};

interface Styles {
  container: ViewStyle;
  icon: IconStyle;
  text: TextStyle;
}

export const DeviceStatusBar: React.FC = () => {
  const { 
    materialId, 
    status: { 
      isOnline, 
      lastSeen, 
      error 
    } 
  } = useDeviceStatus();

  if (!materialId) {
    return null; // Don't show status bar if device is not registered
  }

  let statusText: string;
  let iconName: keyof typeof MaterialIcons.glyphMap = 'wifi-off';
  let backgroundColor = '#fff3cd'; // Light yellow (default for offline)
  let textColor = '#856404'; // Dark yellow
  
  // Set status based on online status and errors
  // Unregistered devices and offline status are informational, not errors
  if (error && (
    error.includes('unregistered') || 
    error.includes('not registered') || 
    error.includes('No registered device') ||
    error.includes('Device has been') ||
    error.includes('Material ID is required') ||
    error.includes('Please register') ||
    error.includes('Registration required') ||
    error.includes('Registration Required') ||
    error.includes('registration')
  )) {
    // Unregistered device - show as informational (not error)
    statusText = error.includes('unregistered') || error.includes('Device has been') || error.includes('No registered device')
      ? 'No Registered Device' 
      : 'Registration Required';
    iconName = 'info';
    backgroundColor = '#d1ecf1'; // Light blue (informational)
    textColor = '#0c5460'; // Dark blue
  } else if (error && !error.includes('Unable to establish connection')) {
    // Only show errors for connection issues after max attempts
    statusText = 'Connection Issue';
    iconName = 'error';
    backgroundColor = '#f8d7da'; // Light red
    textColor = '#721c24'; // Dark red
  } else if (isOnline) {
    statusText = 'Online';
    iconName = 'wifi';
    backgroundColor = '#d4edda'; // Light green
    textColor = '#155724'; // Dark green
  } else {
    // Normal offline - show as informational status (not error)
    statusText = 'Offline';
    iconName = 'wifi-off';
    backgroundColor = '#fff3cd'; // Light yellow
    textColor = '#856404'; // Dark yellow
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <MaterialIcons name={iconName} size={16} color={textColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }]}>{statusText}</Text>
    </View>
  );
};

const styles = StyleSheet.create<Styles>({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    paddingHorizontal: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});
