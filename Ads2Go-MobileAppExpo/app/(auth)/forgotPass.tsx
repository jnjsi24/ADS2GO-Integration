//FORGOTPASS

import React, { useState } from 'react';
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


const ForgotPasswordScreen = () => {
  const router = useRouter();

  // Changed initial step to -1 to show the new option screen first
  const [currentStep, setCurrentStep] = useState(-1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timer, setTimer] = useState(60);

  // New state for mobile number flow
  const [phoneNumber, setPhoneNumber] = useState('');

  // Function to handle sending the reset code (mock-up)
  const handleSendCode = () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    Alert.alert('Success', 'A verification code has been sent to your email.');
    setCurrentStep(1);
    setTimer(60);
  };

  // Function to handle verifying the code (mock-up)
  const handleVerifyCode = () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code.');
      return;
    }
    Alert.alert('Success', 'Code verified successfully.');
    setCurrentStep(2);
  };

  // Function to handle resetting the password (mock-up)
  const handleResetPassword = () => {
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    Alert.alert('Success', 'Password has been reset successfully.');
    setCurrentStep(3);
  };

  // New function for mobile number
  const handleSendMobileCode = () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number.');
      return;
    }
    Alert.alert('Success', 'A verification code has been sent to your mobile number.');
    // Move to the next step for mobile code verification
    setCurrentStep(1);
    setTimer(60);
  };

  // Function to render content based on the current step
  const renderContent = () => {
    switch (currentStep) {
      case -1:
        return (
          <>
            <Text style={styles.heading}>Forgot password?</Text>
            <Text style={styles.subheading}>
              Select a method to receive a password reset code.
            </Text>
            <TouchableOpacity style={styles.optionButton} onPress={() => setCurrentStep(0)}>
              <Ionicons name="mail-outline" size={24} color="#4BA3C3" />
              <Text style={styles.optionText}>Use Email</Text>
            </TouchableOpacity>
          </>
        );
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
              />
            </View>
            <TouchableOpacity style={styles.button} onPress={handleSendCode}>
              <Text style={styles.buttonText}>Send code</Text>
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
                    onChangeText={(text) => {
                      const newCode = code.substring(0, index) + text + code.substring(index + 1);
                      setCode(newCode);
                    }}
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.button} onPress={handleVerifyCode}>
              <Text style={styles.buttonText}>Verify</Text>
            </TouchableOpacity>
            <View style={styles.resendContainer}>
              <TouchableOpacity onPress={() => {}} disabled={timer > 0}>
                <Text style={[styles.linkText, timer > 0 && { color: '#ccc' }]}>
                  Send code again: <Text style={styles.linkBold}>{`00:${timer < 10 ? '0' + timer : timer}`}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.heading}>Reset password</Text>
            <Text style={styles.subheading}>
              Please type something you'll remember
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="must be 8 characters"
                  placeholderTextColor="#7f8c8d"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
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
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.passwordToggle}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
              <Text style={styles.buttonText}>Reset password</Text>
            </TouchableOpacity>
          </>
        );
      case 3:
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
        {currentStep !== -1 && currentStep < 3 && (
          <View style={styles.header}>
            {currentStep > -1 && (
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentStep(currentStep === 0.5 ? -1 : currentStep - 1)}>
                <Ionicons name="chevron-back-outline" size={24} color="#000" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Ads2go</Text>
            <Ionicons name="star" size={24} color="#4BA3C3" style={styles.starIcon} />
          </View>
        )}
        <View style={[styles.content, (currentStep === -1 || currentStep === 3) && styles.centeredContent]}>
          {renderContent()}
        </View>
        <View style={styles.linkContainer}>
          {currentStep === 0 && (
            <TouchableOpacity style={styles.link} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.linkText}>Remember password? <Text style={styles.linkBold}>Log in</Text></Text>
            </TouchableOpacity>
          )}
          {currentStep === 2 && (
            <TouchableOpacity style={styles.link} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log in</Text></Text>
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
  // New styles for the option screen
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    width: '100%',
    textAlign: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginLeft: 10,
  },
  // New styles for the mobile number input screen
  mobileInputGroup: {
    flexDirection: 'row',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    overflow: 'hidden',
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    backgroundColor: '#f8f8f8',
    borderRightWidth: 1,
    borderRightColor: '#e1e5e9',
  },
  countryText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2c3e50',
  },
  countryCodeText: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  mobileInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#2c3e50',
  },
});

export default ForgotPasswordScreen;
