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
  let backgroundColor = '#f8d7da'; // Light red
  let textColor = '#721c24'; // Dark red
  
  // Set status based on online status and errors
  if (error) {
    statusText = `Error: ${error}`;
    iconName = 'error';
    backgroundColor = '#f8d7da';
    textColor = '#721c24';
  } else if (isOnline) {
    statusText = 'Online';
    iconName = 'wifi';
    backgroundColor = '#d4edda'; // Light green
    textColor = '#155724'; // Dark green
  } else {
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
