import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface FloatingNotificationIconProps {
  notificationCount?: number;
}

const FloatingNotificationIcon: React.FC<FloatingNotificationIconProps> = ({ 
  notificationCount = 0 
}) => {
  const router = useRouter();
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for new notifications
  useEffect(() => {
    if (notificationCount > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [notificationCount, pulseAnim]);

  const handlePress = () => {
    // Navigate to notifications screen within tabs
    router.push('/(tabs)/notifications');
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications" size={24} color="#ffffff" />
          
          {/* Notification Badge */}
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100, // Position above the bottom navigation
    right: 20,
    zIndex: 1000,
  },
  iconContainer: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3674B5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default FloatingNotificationIcon;
