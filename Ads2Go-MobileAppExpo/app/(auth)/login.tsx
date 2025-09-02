//LOGIN

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { request, gql } from "graphql-request";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Ionicons } from "@expo/vector-icons"; // icons for password toggle + socials

import API_CONFIG from "../../config/api";
const API_URL = API_CONFIG.API_URL;

// ✅ Keep your GraphQL mutation
const LOGIN_MUTATION = gql`
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

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // New state for the checkbox

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

      const data = await request<LoginResponse>(
        API_URL,
        LOGIN_MUTATION,
        variables
      );

      console.log("Login response:", JSON.stringify(data, null, 2));
      console.log("Driver data:", data.loginDriver?.driver);
      console.log("Driver ID:", data.loginDriver?.driver?.driverId);
      console.log("Driver _id:", data.loginDriver?.driver?.id);

      if (data.loginDriver?.message?.includes("PENDING")) {
        const pendingDriver = data.loginDriver.driver || {
          email: variables.email,
          driverId: "",
          firstName: "",
          accountStatus: "PENDING",
          isEmailVerified: false,
        };

        await AsyncStorage.setItem(
          "pendingDriver",
          JSON.stringify(pendingDriver)
        );

        router.push({
          pathname: "/(auth)/verificationProgress",
          params: {
            email: pendingDriver.email,
            driverId: pendingDriver.driverId,
            token: "",
            firstName: pendingDriver.firstName,
            isPending: true,
          },
        } as any);
        return;
      }

      if (data.loginDriver?.success && data.loginDriver.token) {
        // Here's where you would add the logic to save the token if 'rememberMe' is true
        // For example: if (rememberMe) { await AsyncStorage.setItem("token", data.loginDriver.token); }

        await AsyncStorage.setItem("token", data.loginDriver.token);

        if (data.loginDriver.driver) {
          console.log("📱 Storing driver data in AsyncStorage...");
          
          // Store driver info
          await AsyncStorage.setItem(
            "driverInfo",
            JSON.stringify(data.loginDriver.driver)
          );
          console.log("✅ Stored driverInfo");
          
          // Store driver ID separately for easy access
          const driverId = data.loginDriver.driver.driverId || data.loginDriver.driver.id;
          console.log("🔑 Extracted driverId:", driverId);
          
          if (driverId) {
            await AsyncStorage.setItem("driverId", driverId);
            console.log("✅ Stored driverId in AsyncStorage:", driverId);
          } else {
            console.log("❌ No driverId found in driver data");
          }
          
          // Debug: Verify what was stored
          const storedDriverId = await AsyncStorage.getItem("driverId");
          const storedDriverInfo = await AsyncStorage.getItem("driverInfo");
          console.log("🔍 Verification - stored driverId:", storedDriverId);
          console.log("🔍 Verification - stored driverInfo:", storedDriverInfo);
        }

        const shouldRedirect =
          data.loginDriver.driver?.accountStatus?.toLowerCase() === "pending" ||
          !data.loginDriver.driver?.isEmailVerified;

        if (shouldRedirect) {
          const params = {
            email: data.loginDriver.driver?.email || "",
            driverId:
              data.loginDriver.driver?.driverId ||
              data.loginDriver.driver?.id ||
              "",
            token: data.loginDriver.token,
            firstName: data.loginDriver.driver?.firstName || "",
          };

          router.push({
            pathname: "/(auth)/verificationProgress",
            params,
          } as any);
        } else {
          Alert.alert(
            "Login Success",
            `Welcome ${data.loginDriver.driver?.firstName || ""}!`
          );
          router.replace("/(tabs)");
        }
      } else {
        Alert.alert(
          "Login Failed",
          data.loginDriver?.message || "Something went wrong"
        );
      }
    } catch (err: any) {
      console.error("Login error:", err);
      Alert.alert(
        "Login Error",
        err.response?.errors?.[0]?.message || "Network error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo / Brand */}
      <View style={styles.header}>
        <Text style={styles.logo}>✨</Text>
        <Text style={styles.title}>Ads2go</Text>
      </View>

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
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, { flex: 5, marginBottom: 0, borderWidth: 0 }]}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
        </View>

        {/* New container for the remember me and forgot password links */}
        <View style={styles.formLinksContainer}>
          {/* Remember Me Checkbox */}
          <TouchableOpacity style={styles.rememberMeContainer} onPress={() => setRememberMe(!rememberMe)}>
            <Ionicons
              name={rememberMe ? "checkbox-outline" : "square-outline"}
              size={20}
              color={rememberMe ? "#38b2ac" : "#666"}
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
          disabled={loading}
        >
          {loading ? (
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