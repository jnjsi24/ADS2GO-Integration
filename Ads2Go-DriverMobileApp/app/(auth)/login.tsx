import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import { useRouter, useLocalSearchParams, type Router } from "expo-router";
import { useAuth } from '../../contexts/AuthContext';
// Using native fetch instead of graphql-request for better timeout control
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Ionicons } from "@expo/vector-icons";

import API_CONFIG from "../../config/api";
const API_URL = API_CONFIG.API_URL;

// GraphQL mutation as string for native fetch
const LOGIN_MUTATION = `
  mutation LoginDriver(
    $email: String!
    $password: String!
    $deviceInfo: DeviceInfoInput!
  ) {
    loginDriver(email: $email, password: $password, deviceInfo: $deviceInfo) {
      success
      message
      token
      driver {
        id
        driverId
        firstName
        lastName
        email
        accountStatus
        isEmailVerified
      }
    }
  }
`;

type LoginResponse = {
  loginDriver: {
    success: boolean;
    message: string;
    token: string | null;
    driver: {
      id: string;
      driverId: string;
      firstName: string;
      lastName: string;
      email: string;
      accountStatus: string;
      isEmailVerified: boolean;
    } | null;
  };
};

type LoginFormState = {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  rememberMe: boolean;
  successMessage: string | null;
  errorMessage: string | null;
};

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ message?: string }>();
  
  const [formState, setFormState] = useState<LoginFormState>({
    email: "",
    password: "",
    showPassword: false,
    loading: false,
    rememberMe: false,
    successMessage: null,
    errorMessage: null,
  });
  
  // Handle success messages from navigation
  useEffect(() => {
    const message = Array.isArray(params?.message) 
      ? params.message[0] 
      : params?.message;
      
    if (message) {
      setFormState(prev => ({
        ...prev,
        successMessage: message.toString()
      }));
      
      const timer = setTimeout(() => {
        setFormState(prev => ({
          ...prev,
          successMessage: null
        }));
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [params?.message]);

  // Handle back button to prevent going back to authenticated screens
  useEffect(() => {
    const backAction = () => {
      // Prevent going back from login screen
      return true; // Return true to prevent default back behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, []);

  const handleLogin = async () => {
    try {
      setFormState(prev => ({ ...prev, loading: true }));

      const variables = {
        email: formState.email,
        password: formState.password,
        deviceInfo: {
          deviceId: Device.osBuildId || "unknown_device",
          deviceType: Device.osName || "unknown_os",
          deviceName: Device.modelName || "unknown_model",
        },
      };

      // Use native fetch with timeout control like AndroidPlayerExpo
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: LOGIN_MUTATION,
          variables: variables
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error');
      }
      
      const loginResponse: LoginResponse = result.data;

      if (loginResponse.loginDriver?.success && loginResponse.loginDriver.token) {
        // Sign in using our auth context which will handle token storage
        await signIn(loginResponse.loginDriver.token);

        if (loginResponse.loginDriver.driver) {
          // Store driver info in AsyncStorage
          await AsyncStorage.setItem(
            "driverInfo",
            JSON.stringify(loginResponse.loginDriver.driver)
          );
          
          // Store driver ID separately for easy access
          const driverId = loginResponse.loginDriver.driver.driverId || 
                         loginResponse.loginDriver.driver.id;
          if (driverId) {
            await AsyncStorage.setItem("driverId", driverId);
          }
        }

        // Check if the account needs email verification (but not pending status)
        const needsEmailVerification = !loginResponse.loginDriver.driver?.isEmailVerified;

        if (needsEmailVerification && loginResponse.loginDriver.driver) {
          // Navigate to verification screen if email needs verification
          const navParams = {
            email: loginResponse.loginDriver.driver.email || "",
            driverId: loginResponse.loginDriver.driver.driverId || 
                     loginResponse.loginDriver.driver.id || "",
            firstName: loginResponse.loginDriver.driver.firstName || "",
            token: loginResponse.loginDriver.token,
          };
        
          // Type assertion to handle Expo Router's navigation params
          router.push({
            pathname: "/(auth)/verificationProgress",
            params: navParams as Record<string, string>,
          });
        } else {
          // Navigate to main app if no verification needed
          router.replace("/(tabs)");
        }
      } else {
        // Show error message if login failed
        setFormState(prev => ({
          ...prev,
          loading: false,
          errorMessage: loginResponse.loginDriver?.message || "Login failed. Please try again."
        }));
        
        // Clear the error message after 5 seconds
        setTimeout(() => {
          setFormState(prev => ({
            ...prev,
            errorMessage: null
          }));
        }, 5000);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      let errorMessage = "An error occurred during login. Please try again.";
      
      // Handle specific error types like AndroidPlayerExpo
      if (error.name === 'AbortError' || error.message?.includes("aborted")) {
        errorMessage = "Request timed out. Please check your internet connection and try again.";
      } else if (error.message?.includes("Network request timed out")) {
        errorMessage = "Network request timed out. Please check your internet connection and try again.";
      } else if (error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.message?.includes("Invalid credentials")) {
        errorMessage = "Invalid email or password. Please check your credentials and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setFormState(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo / Brand */}
      <View style={styles.header}>
        <Text style={styles.logo}>✨</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>

      {formState.successMessage && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>{formState.successMessage}</Text>
        </View>
      )}

      {formState.errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{formState.errorMessage}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Text style={styles.tabActiveText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={styles.tabTextInactive}>Register</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          placeholder="Your email"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          value={formState.email}
          onChangeText={(email) => setFormState(prev => ({ ...prev, email }))}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, { flex: 5, marginBottom: 0, borderWidth: 0 }]}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry={!formState.showPassword}
            value={formState.password}
            onChangeText={(password) => setFormState(prev => ({ ...prev, password }))}
          />
          <TouchableOpacity onPress={() => setFormState(prev => ({ ...prev, showPassword: !prev.showPassword }))} style={styles.passwordToggle}>
              <Ionicons
                name={formState.showPassword ? "eye-off" : "eye"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
        </View>

        {/* New container for the remember me and forgot password links */}
        <View style={styles.formLinksContainer}>
          {/* Remember Me Checkbox */}
          <TouchableOpacity 
          style={styles.rememberMeContainer} 
          onPress={() => setFormState(prev => ({ ...prev, rememberMe: !prev.rememberMe }))}
        >
          <Ionicons
            name={formState.rememberMe ? "checkbox-outline" : "square-outline"}
            size={20}
            color={formState.rememberMe ? "#38b2ac" : "#666"}
          />
          <Text style={styles.rememberMeText}>Remember me</Text>
        </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push("/(auth)/forgotPass")}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={handleLogin}
          disabled={formState.loading}
        >
          {formState.loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginBtnText}>Log In</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <Text style={styles.orText}>or Login with</Text>

        {/* Socials */}
        <View style={styles.socials}>
          <TouchableOpacity style={styles.socialBtn}>
            <Ionicons name="logo-facebook" size={22} color="#1877F2" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn}>
            <Ionicons name="logo-google" size={22} color="#DB4437" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn}>
            <Ionicons name="logo-apple" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center", padding: 20 },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  header: { alignItems: "center", marginBottom: 30 },
  logo: { fontSize: 30 },
  title: { fontSize: 22, fontWeight: "700", marginTop: 8 },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 5,
    width: '100%',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  tabActiveText: {
    color: '#1B5087',
    fontWeight: 'bold',
  },
  tabTextInactive: {
    color: '#999',
  },
  form: {},
  label: { fontSize: 14, marginBottom: 6, fontWeight: "500", color: "#2E2E2E" },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    marginBottom: 0,
  },
  passwordToggle: {
    padding: 5,
  },
  // New styles for the remember me and forgot password links
  formLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberMeText: {
    fontSize: 13,
    color: "#555",
    marginLeft: 5,
  },
  forgotBtn: { 
    alignSelf: "flex-end",
    // Remove the marginBottom and marginTop
  },
  forgotText: { 
    fontSize: 13,
    color: "#555"
  },
  loginBtn: {
    backgroundColor: "#1B5087",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  loginBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  orText: { textAlign: "center", color: "#999", marginBottom: 15, fontSize: 14 },
  socials: { flexDirection: "row", justifyContent: "center", gap: 15 },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
});