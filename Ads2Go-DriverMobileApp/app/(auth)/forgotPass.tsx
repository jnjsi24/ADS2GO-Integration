//FORGOTPASS

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import API_CONFIG from '@/config/api';

const ForgotPasswordScreen = () => {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0 && currentStep === 1) {
      interval = setInterval(() => {
        setTimer(timer - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer, currentStep]);

  // GraphQL mutation to request password reset
  const requestPasswordReset = async () => {
    const query = `
      mutation RequestDriverPasswordReset($email: String!) {
        requestDriverPasswordReset(email: $email) {
          success
          message
        }
      }
    `;

    try {
      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { email: email.toLowerCase().trim() }
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        return { success: false, message: result.errors[0]?.message || 'Request failed' };
      }

      return result.data?.requestDriverPasswordReset || { success: false, message: 'Network error' };
    } catch (error) {
      console.error('Request password reset error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // GraphQL mutation to reset password with code
  const resetPasswordWithCode = async () => {
    const query = `
      mutation ResetDriverPasswordWithCode($token: String!, $newPassword: String!) {
        resetDriverPasswordWithCode(token: $token, newPassword: $newPassword) {
          success
          message
        }
      }
    `;

    try {
      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { 
            token: code.trim(),
            newPassword: newPassword.trim()
          }
        }),
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        return { success: false, message: result.errors[0]?.message || 'Reset failed' };
      }

      return result.data?.resetDriverPasswordWithCode || { success: false, message: 'Network error' };
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  // Function to handle sending the reset code
  const handleSendCode = async () => {
    if (!email || !email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset();
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'A verification code has been sent to your email.');
      setCurrentStep(1);
      setTimer(60);
      setCode(''); // Reset code input
    } else {
      Alert.alert('Error', result.message || 'Failed to send verification code.');
    }
  };

  // Function to handle resetting the password
  const handleResetPassword = async () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await resetPasswordWithCode();
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Password has been reset successfully.');
      setCurrentStep(2);
    } else {
      Alert.alert('Error', result.message || 'Failed to reset password.');
    }
  };

  // Function to handle resending code
  const handleResendCode = async () => {
    setLoading(true);
    const result = await requestPasswordReset();
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'A new verification code has been sent to your email.');
      setTimer(60);
      setCode(''); // Reset code input
    } else {
      Alert.alert('Error', result.message || 'Failed to resend verification code.');
    }
  };

  // Function to render content based on the current step
  const renderContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <Text style={styles.heading}>Forgot password?</Text>
            <Text style={styles.subheading}>
              Don't worry! It happens. Please enter the email associated with your account.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#7f8c8d"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSendCode}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Sending...' : 'Send code'}
              </Text>
            </TouchableOpacity>
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.heading}>Please check your email</Text>
            <Text style={styles.subheading}>
              We've sent a code to <Text style={styles.subheadingBold}>{email}</Text>
            </Text>
            <View style={styles.codeContainer}>
              {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} style={[styles.codeInput, { borderColor: code.length === index ? '#1B5087' : '#e1e5e9' }]}>
                  <TextInput
                    style={styles.codeInputText}
                    maxLength={1}
                    keyboardType="numeric"
                    value={code[index] || ''}
                    editable={!loading}
                    onChangeText={(text) => {
                      const newCode = code.substring(0, index) + text + code.substring(index + 1);
                      setCode(newCode);
                      
                      // Auto-focus next input
                      if (text && index < 5) {
                        // You can implement auto-focus logic here if needed
                      }
                    }}
                  />
                </View>
              ))}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="must be at least 6 characters"
                  placeholderTextColor="#7f8c8d"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.passwordToggle}>
                  <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm new password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="repeat password"
                  placeholderTextColor="#7f8c8d"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.passwordToggle}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Resetting...' : 'Reset password'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.resendContainer}>
              <TouchableOpacity 
                onPress={handleResendCode} 
                disabled={timer > 0 || loading}
              >
                <Text style={[styles.linkText, (timer > 0 || loading) && { color: '#ccc' }]}>
                  {timer > 0 
                    ? `Send code again: ${`00:${timer < 10 ? '0' + timer : timer}`}`
                    : 'Send code again'
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );

      case 2:
        return (
          <>
            <Text style={[styles.changed, { fontSize: 30 }]}>Password changed</Text>
            <Text style={styles.subchanged}>
              Your password has been changed successfully
            </Text>
            <TouchableOpacity style={[styles.button, { alignSelf: 'stretch' }]} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.buttonText}>Back to login</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {currentStep < 2 && (
          <View style={styles.header}>
            {currentStep > 0 && (
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => {
                  if (currentStep === 1) {
                    setCurrentStep(0);
                    setCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setTimer(60);
                  }
                }}
                disabled={loading}
              >
                <Ionicons name="chevron-back-outline" size={24} color="#000" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Ads2go</Text>
            <Ionicons name="star" size={24} color="#4BA3C3" style={styles.starIcon} />
          </View>
        )}
        <View style={[styles.content, currentStep === 2 && styles.centeredContent]}>
          {renderContent()}
        </View>
        <View style={styles.linkContainer}>
          {(currentStep === 0 || currentStep === 1) && (
            <TouchableOpacity style={styles.link} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.linkText}>
                Remember password? <Text style={styles.linkBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 40,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
  },
  starIcon: {
    marginLeft: 10,
  },
  backButton: {
    position: 'absolute',
    left: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  changed: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subchanged: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 22,
    textAlign: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 22,
  },
  subheadingBold: {
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  button: {
    height: 50,
    backgroundColor: '#1B5087',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
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
  codeInputText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    height: '100%',
    width: '100%',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2c3e50',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  passwordToggle: {
    padding: 5,
  },
  link: {
    alignSelf: 'center',
  },
  linkText: {
    color: '#7f8c8d',
    fontSize: 14,
  },
  linkBold: {
    fontWeight: 'bold',
    color: '#1B5087',
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ForgotPasswordScreen;