//EMAILVERIFICATION

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import API_CONFIG from "../../config/api";
import { Ionicons } from '@expo/vector-icons';

// Define your navigation stack params
type EmailVerificationRouteProp = RouteProp<RootStackParamList, '(auth)/emailVerification'>;

type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const EmailVerification = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<EmailVerificationRouteProp>();
  const { email, driverId, token, firstName } = route.params;

  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Create refs for each input
  const inputRefs = useRef<Array<TextInput | null>>(Array(6).fill(null));

  // Function to set refs
  const setInputRef = (index: number) => (ref: TextInput | null) => {
    inputRefs.current[index] = ref;
  };

  // Timer for resend functionality
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            setCanResend(true);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeLeft]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow numeric input
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleVerifyEmail(newCode.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    // Handle backspace to move to previous input
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyEmail = async (code?: string) => {
    const codeToVerify = code || verificationCode.join('');
    
    if (codeToVerify.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `
            mutation VerifyDriverEmail($code: String!) {
              verifyDriverEmail(code: $code) {
                success
                message
                driver {
                  driverId
                  email
                  isEmailVerified
                  accountStatus
                }
              }
            }
          `,
          variables: {
            code: codeToVerify,
          },
        }),
      });

      const result = await response.json();

      if (result.data?.verifyDriverEmail?.success) {
        // Navigate to verification progress screen
        navigation.navigate('(auth)/verificationProgress' as any, {
          email,
          driverId,
          token,
          firstName: firstName || ''
        } as any);
      } else {
        const errorMessage = result.data?.verifyDriverEmail?.message || 
                           result.errors?.[0]?.message || 
                           'Verification failed. Please try again.';
        
        // Clear the code inputs on error
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        Alert.alert('Verification Failed', errorMessage);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: `
            mutation ResendDriverVerificationCode($email: String!) {
              resendDriverVerificationCode(email: $email) {
                success
                message
              }
            }
          `,
          variables: {
            email: email,
          },
        }),
      });

      const result = await response.json();

      if (result.data?.resendDriverVerificationCode.success) {
        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
        
        // Reset timer
        setTimeLeft(60);
        setCanResend(false);
        
        // Clear current code
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        const errorMessage = result.data?.resendDriverVerificationCode.message || 
                           result.errors?.[0]?.message || 
                           'Failed to resend code. Please try again.';
        Alert.alert('Error', errorMessage);
      }
    } catch (error: any) {
      console.error('Resend error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Ionicons name="sparkles" size={30} color="#34D9B0" style={styles.sparkleIcon} />
        <View style={styles.header}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a code to <Text style={styles.email}>{email}</Text>
          </Text>
          <Text style={styles.description}>
            Enter the code below to verify your email address and complete your registration.
          </Text>
        </View>

        <View style={styles.codeContainer}>
          {verificationCode.map((digit, index) => (
            <TextInput
              key={index}
              ref={setInputRef(index)}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                loading && styles.codeInputDisabled
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              editable={!loading}
              selectTextOnFocus
            />
          ))}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3498db" />
            <Text style={styles.loadingText}>Verifying code...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.verifyButton,
            (verificationCode.some(digit => !digit) || loading) && styles.verifyButtonDisabled
          ]}
          onPress={() => handleVerifyEmail()}
          disabled={verificationCode.some(digit => !digit) || loading}
        >
          <Text style={styles.verifyButtonText}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </Text>
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Send code again</Text>
          {canResend ? (
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resendLoading}
            >
              <Text style={styles.resendButtonText}>
                {resendLoading ? 'Sending...' : 'Resend'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              {formatTime(timeLeft)}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.changeEmailButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.changeEmailText}>Change Email Address</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 5,
  },
  email: {
    fontWeight: '600',
    color: '#FF9800',
  },
  description: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  codeInput: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeInputFilled: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    height: '100%',
    width: '100%',
  },
  codeInputDisabled: {
    backgroundColor: '#f8f9fa',
    color: '#bdc3c7',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#7f8c8d',
  },
  verifyButton: {
    backgroundColor: '#1B5087',
    paddingVertical: 15,
    borderRadius: 8,
    width: '105%',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#1B5087',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    justifyContent: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 5,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  timerText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  changeEmailButton: {
    position: 'absolute',
    bottom: 50, // Add padding from the bottom
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  changeEmailText: {
    fontSize: 14,
    color: '#1B5087',
    fontWeight: 'bold',
  },
});

export default EmailVerification;