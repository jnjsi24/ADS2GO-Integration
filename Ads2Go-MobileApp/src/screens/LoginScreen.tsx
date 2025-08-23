import React, { useState } from "react";
import {
  View, 
  Text, 
  TextInput, 
  Button, 
  StyleSheet,
  TouchableOpacity, 
  ImageBackground, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { gql, useMutation } from "@apollo/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Auth: undefined;
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

type FormErrors = {
  email?: string;
  password?: string;
};

const LoginScreen = ({ navigation }: Props) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const [loginDriver] = useMutation(LOGIN_DRIVER, {
    onError: (error) => {
      console.error("Login error:", error);
      Alert.alert("Login Failed", error.message || "An error occurred during login.");
    },
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    const credentials = {
      email: formData.email.trim(),
      password: formData.password
    };
    
    console.log('Attempting login with:', { 
      email: credentials.email,
      hasPassword: !!credentials.password 
    });
    
    try {
      const { data, errors: gqlErrors } = await loginDriver({
        variables: credentials,
        fetchPolicy: 'no-cache' // Ensure we don't get cached responses
      });

      console.log('Login response received');
      
      if (gqlErrors) {
        console.error('GraphQL Errors:', JSON.stringify(gqlErrors, null, 2));
        throw new Error(gqlErrors[0]?.message || 'Authentication failed');
      }

      if (!data?.loginDriver) {
        console.error('No loginDriver data in response');
        throw new Error('Invalid server response');
      }

      if (!data.loginDriver.token) {
        console.error('No token in response:', data);
        throw new Error('Authentication failed: No token received');
      }

      console.log('Login successful, storing token and user data');
      
      // Store token and user data
      await Promise.all([
        AsyncStorage.setItem("authToken", data.loginDriver.token),
        AsyncStorage.setItem("userData", JSON.stringify(data.loginDriver.driver))
      ]);

      console.log('Navigation to Home screen');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = 'An error occurred. Please try again later.';
      
      if (error.networkError) {
        console.error('Network error:', error.networkError);
        errorMessage = 'Cannot connect to the server. Please check your connection.';
      } else if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        console.error('GraphQL errors:', error.graphQLErrors);
        errorMessage = error.graphQLErrors[0].message || 'Invalid request';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ImageBackground
        source={require("../../assets/background.jpg")}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text style={styles.title}>Driver Login</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input, 
                  errors.email && styles.inputError
                ]}
                placeholder="Email"
                value={formData.email}
                onChangeText={(text) => handleInputChange('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#999"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input, 
                  errors.password && styles.inputError
                ]}
                placeholder="Password"
                value={formData.password}
                onChangeText={(text) => handleInputChange('password', text)}
                secureTextEntry
                placeholderTextColor="#999"
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate("Register")}
                disabled={isLoading}
              >
                <Text style={styles.link}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    margin: 20,
    padding: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputError: {
    borderColor: '#ff6b6b',
    borderWidth: 1,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  button: {
    backgroundColor: '#4a90e2',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonDisabled: {
    backgroundColor: '#a0c4ff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
  },
  link: {
    color: '#4a90e2',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoginScreen;
