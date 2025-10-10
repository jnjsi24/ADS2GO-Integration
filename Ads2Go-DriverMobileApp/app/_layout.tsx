//LAYOUT

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Removed FloatingNotificationIcon - using dedicated notifications page instead
import 'react-native-reanimated';

// Removed notification service import to prevent Expo Go errors
// Notifications are now handled only in the notifications page

function RootLayoutNav() {
  const { state } = useAuth();
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

  // Removed automatic notification initialization to prevent Expo Go errors
  // Notifications will be initialized only when explicitly requested by the user

  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={{ flex: 1 }}>
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
              <Stack.Screen name="materials" options={{ title: 'Materials' }} />
              <Stack.Screen name="+not-found" />
            </>
          ) : (
            <Stack.Screen name="(tabs)" redirect={true} />
          )}
        </Stack>
        
        {/* Removed floating notification bell - using dedicated notifications page instead */}
        
        <StatusBar style="dark" />
      </View>
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