//LAYOUT

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import notification service with error handling
let NotificationService: any = null;
try {
  NotificationService = require('../services/notificationService').default;
} catch (error) {
  console.log('⚠️ Notification service not available:', error instanceof Error ? error.message : 'Unknown error');
}
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

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (state.token && NotificationService) {
      const initializeNotifications = async () => {
        try {
          const notificationService = NotificationService.getInstance();
          
          // Register for push notifications
          await notificationService.registerForPushNotifications();
          
          // Set up notification listeners
          const cleanup = notificationService.setupNotificationListeners();
          
          // Return cleanup function
          return cleanup;
        } catch (error) {
          console.error('❌ Error initializing notifications:', error);
        }
      };

      const cleanupPromise = initializeNotifications();
      
      return () => {
        cleanupPromise.then(cleanup => {
          if (cleanup) cleanup();
        });
      };
    } else if (state.token && !NotificationService) {
      console.log('⚠️ Notification service not available - skipping notification initialization');
    }
  }, [state.token]);

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