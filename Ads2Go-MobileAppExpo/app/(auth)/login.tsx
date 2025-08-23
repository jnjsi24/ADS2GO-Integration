import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { request, gql } from "graphql-request";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device"; // ✅ to grab real device info

// Backend endpoint
const API_URL = "http://192.168.100.22:5000/graphql";
// If using Android Emulator, you can use: 
// //const API_URL = "http://10.0.2.2:5000/graphql"; // special alias for localhost

// ✅ Updated mutation with deviceInfo
const LOGIN_MUTATION = gql`
  mutation LoginDriver($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    loginDriver(email: $email, password: $password, deviceInfo: $deviceInfo) {
      success
      message
      token
      driver {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

// ✅ Define response type
type LoginResponse = {
  loginDriver: {
    success: boolean;
    message: string;
    token: string | null;
    driver: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
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

      // ✅ request with types
      const data = await request<LoginResponse>(API_URL, LOGIN_MUTATION, variables);

      if (data.loginDriver?.success && data.loginDriver.token) {
        await AsyncStorage.setItem("token", data.loginDriver.token);

        Alert.alert("Login Success", `Welcome ${data.loginDriver.driver?.firstName || ""}!`);
        router.replace("/(tabs)"); // Go to dashboard
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
