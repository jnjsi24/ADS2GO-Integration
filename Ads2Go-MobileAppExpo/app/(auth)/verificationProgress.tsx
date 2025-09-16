import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import API_CONFIG from '../../config/api';
import { RootStackParamList } from '../../types/navigation';

type VerificationProgressRouteProp = RouteProp<RootStackParamList, '(auth)/verificationProgress'>;
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

const VerificationProgress = () => {
  const route = useRoute<VerificationProgressRouteProp>();
  const navigation = useNavigation<NavigationProps>();
  
  // Get params from route
  console.log('Route params:', route.params);
  const { 
    email = '', 
    verificationCode = '',
    firstName = '',
    driverId = '',
    token = ''
  } = route.params || {};
  
  // Log the extracted values
  console.log('Extracted values:', { email, verificationCode, firstName, driverId, token });
  
  // State for UI
  type StatusType = 'pending' | 'approved' | 'active' | 'rejected' | 'not_found';
  const [status, setStatus] = useState<StatusType>('pending');
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check verification status on mount
  useEffect(() => {
    console.log('Component mounted with driverId:', driverId);
    
    if (driverId) {
      console.log('Checking verification status on mount...');
      checkVerificationStatus();
    } else {
      const errorMsg = 'Missing driver ID. Please try the verification link again.';
      console.error(errorMsg);
      setError(errorMsg);
    }
  }, [driverId]);

  const checkVerificationStatus = async () => {
    console.log('checkVerificationStatus called for driverId:', driverId);
    
    if (!driverId) {
      const errorMsg = 'Missing driver ID. Cannot check verification status.';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    setCheckingStatus(true);
    setError(null);

    try {
      const query = `
        query CheckDriverVerificationStatus($driverId: ID!) {
          checkDriverVerificationStatus(driverId: $driverId) {
            status
            isEmailVerified
            message
          }
        }
      `;

      const variables = { 
        driverId: driverId
      };

      const headers = {
        'Content-Type': 'application/json'
      };

      console.log('Sending request to:', API_CONFIG.API_URL);
      console.log('Query:', query);
      console.log('Variables:', variables);
      
      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(result.errors[0]?.message || 'Failed to check verification status');
      }
      
      // Get status from verification check
      const statusData = result.data?.checkDriverVerificationStatus as {
        status: StatusType;
        isEmailVerified: boolean;
        message?: string;
      } | undefined;
      
      console.log('Verification status response:', statusData);
      
      if (!statusData?.status) {
        throw new Error(statusData?.message || 'Invalid response from server');
      }

      // Update the status in state
      setStatus(statusData.status);

      // If account is approved/active and email is verified, navigate to login
      if ((statusData.status === 'approved' || statusData.status === 'active') && statusData.isEmailVerified) {
        // Navigate to login screen with success message
        navigation.reset({
          index: 0,
          routes: [{
            name: '(auth)/login' as never,
            params: {
              message: 'Your account has been verified! Please log in to continue.'
            }
          }],
        });
      } else if (statusData.status === 'not_found') {
        setError('Account not found. Please check your information and try again.');
      }
    } catch (error: unknown) {
      console.error('Error checking verification status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check status. Please try again.';
      setError(errorMessage);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear any stored user data
      await AsyncStorage.multiRemove(['user', 'token', 'driverId']);
      
      // Navigate back to login screen
      navigation.reset({
        index: 0,
        routes: [{ name: '(auth)/login' as never }],
      });
    } catch (error: unknown) {
      console.error('Error during logout:', error);
      // Still navigate to login even if clearing storage fails
      navigation.reset({
        index: 0,
        routes: [{ name: '(auth)/login' as never }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="verified-user" size={64} color="#3f51b5" style={styles.icon} />
        
        <Text style={styles.title}>Account Verification</Text>
        
        {checkingStatus ? (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#3f51b5" />
            <Text style={styles.statusText}>Checking your verification status...</Text>
          </View>
        ) : status === 'approved' ? (
          <View style={styles.statusContainer}>
            <MaterialIcons name="check-circle" size={48} color="#4caf50" style={styles.statusIcon} />
            <Text style={[styles.statusText, styles.successText]}>Your account has been approved!</Text>
            <Text style={styles.subText}>Please log in to continue.</Text>
          </View>
        ) : status === 'rejected' ? (
          <View style={styles.statusContainer}>
            <MaterialIcons name="cancel" size={48} color="#f44336" style={styles.statusIcon} />
            <Text style={[styles.statusText, styles.errorText]}>Account Not Approved</Text>
            <Text style={styles.subText}>Your account has been rejected. Please contact support for more information.</Text>
          </View>
        ) : status === 'not_found' ? (
          <View style={styles.statusContainer}>
            <MaterialIcons name="error" size={48} color="#ff9800" style={styles.statusIcon} />
            <Text style={[styles.statusText, styles.errorText]}>Verification Failed</Text>
            <Text style={styles.subText}>The verification link is invalid or has expired.</Text>
          </View>
        ) : (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#3f51b5" />
            <Text style={styles.statusText}>Your account is pending approval</Text>
            <Text style={styles.subText}>We'll notify you once your account is reviewed.</Text>
          </View>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]}
            onPress={() => {
              console.log('Check Status button pressed');
              console.log('Current checkingStatus:', checkingStatus);
              checkVerificationStatus();
            }}
            disabled={checkingStatus}
          >
            <Text style={styles.buttonText}>
              {checkingStatus ? 'Checking...' : 'Check Status'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={handleLogout}
            disabled={checkingStatus}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  statusIcon: {
    marginBottom: 15,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  subText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  successText: {
    color: '#4caf50',
  },
  errorText: {
    color: '#f44336',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 10,
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#3f51b5',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3f51b5',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#3f51b5',
  },
});

export default VerificationProgress;
