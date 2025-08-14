import React, { useState } from "react";
import {
  View, Text, TextInput, Button, StyleSheet,
  TouchableOpacity, ImageBackground, Alert
} from "react-native";
import { gql, useMutation } from "@apollo/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined; // Add other screens as needed
};

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const LOGIN_DRIVER = gql`
  mutation LoginDriver($email: String!, $password: String!) {
    loginDriver(email: $email, password: $password) {
      token
      driver {
        driverId
        firstName
        lastName
        email
        verified
        contactNumber
      }
    }
  }
`;

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginDriver, { loading }] = useMutation(LOGIN_DRIVER);

  const handleLogin = async () => {
    try {
      const { data } = await loginDriver({
        variables: { email, password }
      });

      if (data?.loginDriver?.token) {
        await AsyncStorage.setItem("token", data.loginDriver.token);
        console.log("Login success:", data.loginDriver.driver);

        // Navigate to home or dashboard
        navigation.replace("Home");
      }
    } catch (error: any) {
      console.error("Login error:", error.message);
      Alert.alert("Login Failed", error.message || "Invalid credentials.");
    }
  };

  return (
    <ImageBackground
      source={require("../../assets/background.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button title={loading ? "Logging in..." : "Login"} onPress={handleLogin} disabled={loading} />

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Don't have an account? Register</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "white",
  },
  input: {
    height: 50,
    borderColor: "white",
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  link: {
    color: "white",
    textAlign: "center",
    marginTop: 10,
  },
});

export default LoginScreen;
