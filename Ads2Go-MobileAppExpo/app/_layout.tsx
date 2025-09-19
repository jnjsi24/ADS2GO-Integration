//LAYOUT

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

function RootLayoutNav() {
  const { state, signOut } = useAuth();
  const router = useRouter();

  // Check authentication state on app start
  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token && !router.canGoBack()) {
        // If no token and not coming from another auth screen, redirect to login
        router.replace('/(auth)/login');
      }
    };

    checkAuth();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Public routes */}
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
        <Stack.Screen name="(auth)/emailVerification" options={{ title: 'Verify Email' }} />
        <Stack.Screen name="(auth)/verificationProgress" options={{ title: 'Verification Status' }} />
        <Stack.Screen 
          name="(auth)/forgotPass" 
          options={{ 
            title: 'Reset Password',
            headerShown: false 
          }} 
        />

        {/* Protected routes */}
        {state.token ? (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </>
        ) : (
          <Stack.Screen name="(tabs)" redirect={true} />
        )}
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null; // Wait for fonts to load
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}