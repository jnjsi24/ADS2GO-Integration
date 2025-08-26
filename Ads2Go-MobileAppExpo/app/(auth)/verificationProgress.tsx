
//VERIFICATIOBPROGRESS

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import API_CONFIG from "../../config/api";
import { RootStackParamList } from '../../types/navigation';

type VerificationProgressRouteProp = RouteProp<RootStackParamList, '(auth)/verificationProgress'>;

type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

const VerificationProgress = () => {
  const route = useRoute<VerificationProgressRouteProp>();
  const navigation = useNavigation<NavigationProps>();
  
  // Get params from route
  const { email, driverId, token, firstName, isPending } = route.params || {};
  
  console.log('Verification Progress - Route params:', route.params);
  console.log('Verification Progress - Resolved values:', { email, driverId, token, firstName, isPending });
  
  if (!email) {
    console.error('Missing required parameter: email');
    Alert.alert('Error', 'Missing required information. Please try logging in again.');
    navigation.navigate('(auth)/login' as any);
    return null;
  }

  const [status, setStatus] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [checkingStatus, setCheckingStatus] = useState(false); // only true when manually refreshing

  // Only check verification status when manually triggered
  const checkVerificationStatus = async () => {
    if (!driverId) {
      console.log('No driverId available for verification check');
      Alert.alert('Error', 'Unable to check status. Please log in again.');
      navigation.navigate('(auth)/login' as any);
      return;
    }
    
    setCheckingStatus(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `
            query GetDriverStatus($driverId: ID!) {
              getDriver(driverId: $driverId) {
                id
                email
                firstName
                lastName
                accountStatus
                isEmailVerified
                phoneNumber
                createdAt
                updatedAt
              }
            }
          `,
          variables: { driverId },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Verification status response:', JSON.stringify(result, null, 2));
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to check verification status');
      }
      
      if (result.data?.getDriver) {
        const { accountStatus, isEmailVerified } = result.data.getDriver;
        
        if (!isEmailVerified && !isPending) {
          navigation.navigate('(auth)/emailVerification' as any, { 
            email, 
            driverId, 
            token: token || '',
            firstName: route.params?.firstName || ''
          } as any);
          return;
        }

        const newStatus = accountStatus?.toLowerCase() || 'pending';
        setStatus(newStatus);
        
        // If approved, redirect to home
        if (newStatus === 'approved') {
          if (result.data.getDriver) {
            await AsyncStorage.setItem('driverInfo', JSON.stringify(result.data.getDriver));
          }
          
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [{ name: '(tabs)' as any }],
            });
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLogout = () => {
    navigation.navigate('(auth)/login' as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        <Ionicons name="sparkles-sharp" size={30} color="#FF9800" style={styles.sparkleIcon} />
        {status === 'pending' && (
          <>
            <MaterialIcons name="pending-actions" size={80} color="#FFB600" />
            <Text style={styles.title}>
              Your current status is{' '}
              <Text style={styles.pendingText}>PENDING</Text>
            </Text>
            <Text style={styles.subtitle}>
              Your account is currently under review by our admin team. This usually takes 24-48 hours.
            </Text>
          </>
        )}

        {status === 'approved' && (
          <>
            <MaterialIcons name="check-circle" size={80} color="#2ecc71" />
            <Text style={styles.title}>
              Your account has been{' '}
              <Text style={styles.approvedText}>APPROVED</Text>
            </Text>
            <Text style={styles.subtitle}>
              Your account has been approved. Redirecting you to the app...
            </Text>
          </>
        )}

        {status === 'rejected' && (
          <>
            <MaterialIcons name="cancel" size={80} color="#e74c3c" />
            <Text style={styles.title}>
              Your account has been{' '}
              <Text style={styles.rejectedText}>REJECTED</Text>
            </Text>
            <Text style={styles.subtitle}>
              We're sorry, but your account verification was not approved.
            </Text>
            <Text style={styles.note}>
              Please contact support for more information.
            </Text>
          </>
        )}

        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={checkVerificationStatus}
          disabled={checkingStatus}
        >
          {checkingStatus ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.refreshButtonText}>Refresh</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  sparkleIcon: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  pendingText: {
    color: '#FFB600', // This is the color for "PENDING"
  },
  approvedText: {
    color: '#2ecc71', // This is the color for "APPROVED"
  },
  rejectedText: {
    color: '#e74c3c', // This is the color for "REJECTED"
  },
  note: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  statusTitle: {
    fontSize: 16,
    color: '#2c3e50',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f39c12',
  },
  statusApproved: {
    color: '#2ecc71',
  },
  statusRejected: {
    color: '#e74c3c',
  },
  refreshButton: {
    backgroundColor: '#1B5087',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 50,
    padding: 10,
  },
  logoutButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerificationProgress;
