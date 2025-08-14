import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ApolloProvider } from "@apollo/client";
import client from "./src/graphql/apolloClient"; // <- path to your Apollo client

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

// Define the navigation types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Use Native Stack Navigator with defined types
const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <ApolloProvider client={client}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ApolloProvider>
  );
};

export default App;
