import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "react-native-screens/native-stack";
import { ApolloProvider } from "@apollo/client";
import { LogBox, View, Text, StyleSheet } from "react-native";
import client from "./src/graphql/apolloClient";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
]);

// Define the navigation types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Text style={styles.errorDetails}>{this.state.error?.message || 'Unknown error'}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <ApolloProvider client={client}>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Login"
            screenOptions={{
              headerShown: false,
              gestureEnabled: true,
            }}
          >
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              options={{ title: 'Driver Login' }}
            />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen} 
              options={{ title: 'Create Account' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ApolloProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#ff0000',
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default App;
