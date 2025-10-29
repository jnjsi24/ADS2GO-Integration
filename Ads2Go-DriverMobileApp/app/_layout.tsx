import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationToastProvider, useNotificationToast } from '../contexts/NotificationToastContext';
import NotificationToast from '../components/NotificationToast';
import 'react-native-reanimated';

function ToastWrapper() {
  const { toastConfig, isVisible, hideToast } = useNotificationToast();

  if (!toastConfig) return null;

  return (
    <NotificationToast
      visible={isVisible}
      title={toastConfig.title}
      message={toastConfig.message}
      type={toastConfig.type}
      onDismiss={hideToast}
      duration={toastConfig.duration}
    />
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Root route */}
          <Stack.Screen name="index" />
          
          {/* Public routes */}
          <Stack.Screen name="auth" />
          
          {/* Protected routes */}
          <Stack.Screen name="tabs" />
          <Stack.Screen name="materials" options={{ title: 'Materials' }} />
          <Stack.Screen name="documents" options={{ title: 'Documents' }} />
          <Stack.Screen 
            name="photo-submission" 
            options={{ 
              title: 'Photo Submission',
              // Enable swipe/back gesture for this route
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
              animation: 'slide_from_right'
            }} 
          />
          <Stack.Screen name="salary" options={{ title: 'Salary' }} />
          <Stack.Screen name="my-reports" options={{ title: 'My Reports' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        
        {/* Global notification toast */}
        <ToastWrapper />
        
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
      <NotificationToastProvider>
        <RootLayoutNav />
      </NotificationToastProvider>
    </AuthProvider>
  );
}