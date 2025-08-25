import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { request, gql } from "graphql-request";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device"; // ✅ to grab real device info

// Import API configuration
import API_CONFIG from "../../config/api";
const API_URL = API_CONFIG.API_URL;

// Updated mutation with deviceInfo
const LOGIN_MUTATION = gql`
  mutation LoginDriver($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
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

// Define response type
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

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      const variables = {
        email,
        password,
        deviceInfo: {
          deviceId: Device.osBuildId || "unknown_device",
          deviceType: Device.osName || "unknown_os",
          deviceName: Device.modelName || "unknown_model",
        },
      };

      // request with types
      const data = await request<LoginResponse>(API_URL, LOGIN_MUTATION, variables);
      
      console.log('Login response:', JSON.stringify(data, null, 2));

      // Handle pending accounts
      if (data.loginDriver?.message?.includes('PENDING')) {
        // Get the pending driver info from the error message or response
        const pendingDriver = data.loginDriver.driver || {
          email: variables.email,
          // You might need to adjust these based on your actual response
          driverId: '',
          firstName: '',
          accountStatus: 'PENDING',
          isEmailVerified: false
        };
        
        console.log('Account is pending, redirecting to verification progress...');
        
        // Store pending driver info
        await AsyncStorage.setItem('pendingDriver', JSON.stringify(pendingDriver));
        
        // Navigate to verification progress
        router.push({
          pathname: '/(auth)/verificationProgress',
          params: {
            email: pendingDriver.email,
            driverId: pendingDriver.driverId,
            token: '', // No token available for pending accounts
            firstName: pendingDriver.firstName,
            isPending: true
          }
        } as any);
        return;
      }

      if (data.loginDriver?.success && data.loginDriver.token) {
        await AsyncStorage.setItem("token", data.loginDriver.token);

        // Store driver info in AsyncStorage
        if (data.loginDriver.driver) {
          await AsyncStorage.setItem('driverInfo', JSON.stringify(data.loginDriver.driver));
        }

        // Check if account is pending
        console.log('Account status:', data.loginDriver.driver?.accountStatus);
        console.log('Is email verified:', data.loginDriver.driver?.isEmailVerified);
        
        const shouldRedirect = data.loginDriver.driver?.accountStatus?.toLowerCase() === 'pending' || 
                             !data.loginDriver.driver?.isEmailVerified;
        
        console.log('Should redirect to verification progress:', shouldRedirect);
        
        if (shouldRedirect) {
          const params = {
            email: data.loginDriver.driver?.email || '',
            driverId: data.loginDriver.driver?.driverId || data.loginDriver.driver?.id || '',
            token: data.loginDriver.token,
            firstName: data.loginDriver.driver?.firstName || ''
          };
          
          console.log('Navigation params:', params);
          
          try {
            console.log('Attempting to navigate to verification progress...');
            // Use the correct navigation method for Expo Router
            router.push({
              pathname: '/(auth)/verificationProgress',
              params: {
                email: params.email,
                driverId: params.driverId,
                token: params.token,
                firstName: params.firstName
              }
            } as any);
          } catch (navError) {
            console.error('Navigation error:', navError);
            // Fallback to alert if navigation fails
            Alert.alert('Navigation Error', 'Could not open verification page. Please try again.');
          }
        } else {
          // Account is active, go to dashboard
          Alert.alert("Login Success", `Welcome ${data.loginDriver.driver?.firstName || ""}!`);
          router.replace("/(tabs)");
        }
      } else {
        Alert.alert("Login Failed", data.loginDriver?.message || "Something went wrong");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      Alert.alert("Login Error", err.response?.errors?.[0]?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ads2Go Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={loading ? "Logging in..." : "Login"} onPress={handleLogin} disabled={loading} />
      <Button title="Go to Register" onPress={() => router.push("/(auth)/register")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
});