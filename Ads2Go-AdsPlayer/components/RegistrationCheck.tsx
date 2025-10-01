import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import tabletRegistrationService from '../services/tabletRegistration';

interface RegistrationCheckProps {
  children: React.ReactNode;
}

export default function RegistrationCheck({ children }: RegistrationCheckProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  const checkRegistrationStatus = async () => {
    try {
      const registered = await tabletRegistrationService.checkRegistrationStatus();
      setIsRegistered(registered);
      
      // For now, we'll always show the main content
      // In a real implementation, you would redirect to manual connect if not registered
      console.log('Registration status:', registered);
    } catch (error) {
      console.error('Error checking registration status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.text}>Checking registration status...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
});
