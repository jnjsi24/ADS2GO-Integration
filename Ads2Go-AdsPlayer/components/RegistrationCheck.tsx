import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
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
      
      console.log('Registration status:', registered);
      
      // If not registered, redirect to registration screen
      if (!registered) {
        console.log('Device not registered, redirecting to registration screen');
        router.replace('/registration');
        return;
      }
    } catch (error) {
      console.error('Error checking registration status:', error);
      // On error, redirect to registration screen as well
      router.replace('/registration');
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
