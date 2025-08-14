import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

const RegisterScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    console.log("Registering with:", email, password);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      
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

      <TextInput 
        style={styles.input} 
        placeholder="Confirm Password" 
        value={confirmPassword} 
        onChangeText={setConfirmPassword} 
        secureTextEntry 
      />

      <Button title="Register" onPress={handleRegister} />

      <TouchableOpacity onPress={() => navigation.navigate("Login")}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  input: { height: 50, borderColor: "gray", borderWidth: 1, marginBottom: 10, padding: 10, borderRadius: 5 },
  link: { color: "blue", textAlign: "center", marginTop: 10 },
});

export default RegisterScreen;
