import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { DeviceStatusProvider } from '@/contexts/DeviceStatusContext';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';

// ✅ FIX: Suppress console.error for expected network errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Check if any of the arguments contain network error messages
  const errorString = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}`;
    }
    return String(arg);
  }).join(' ');
  
  const isExpectedError = 
    errorString.includes('Network request failed') ||
    errorString.includes('network request failed') ||
    (errorString.includes('TypeError') && errorString.includes('Network')) ||
    errorString.includes('Request cancelled') ||
    errorString.includes('app in background') ||
    errorString.includes('App is in background') ||
    errorString.includes('Failed to fetch') ||
    errorString.includes('NetworkError');
  
  // Only log if it's not an expected network/cancellation error
  if (!isExpectedError) {
    originalConsoleError.apply(console, args);
  }
};

// ✅ FIX: Suppress uncaught promise rejections for expected cancelled requests
// React Native uses ErrorUtils.setGlobalHandler for unhandled promise rejections
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const errorMessage = error?.message || String(error);
    const errorName = error?.name || '';
    const errorString = String(error);
    
    // Check if this is an expected cancellation or network error
    const isExpectedCancellation = 
      (error as any)?.isCancelled === true ||
      (error as any)?.isExpected === true ||
      (error as any)?.isBackground === true ||
      errorName === 'AbortError' ||
      errorName === 'TypeError' && (errorMessage.includes('Network request failed') || errorMessage.includes('network request failed') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) ||
      errorMessage.includes('Request cancelled') ||
      errorMessage.includes('request cancelled') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('App is in background') ||
      errorMessage.includes('app in background') ||
      errorMessage.includes('Network request failed') ||
      errorMessage.includes('network request failed') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('Failed to fetch') ||
      errorString.includes('Network request failed') ||
      errorString.includes('network request failed') ||
      (errorString.includes('TypeError') && errorString.includes('Network'));
    
    if (isExpectedCancellation) {
      // Suppress the error - this is expected behavior when app goes to background or network is unavailable
      // Don't call the original handler for expected cancellations
      return;
    }
    
    // For other errors, use the original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Also handle unhandled promise rejections (React Native specific)
if (typeof global !== 'undefined' && typeof Promise !== 'undefined') {
  const originalUnhandledRejection = (global as any).onunhandledrejection;
  
  (global as any).onunhandledrejection = (event: any) => {
    const error = event?.reason || event;
    // Handle both Error objects and other error types (strings, objects, etc.)
    const errorObj = error || {};
    const errorMessage = errorObj?.message || String(error);
    const errorName = errorObj?.name || '';
    const errorString = String(error);
    
    // Check if this is an expected cancellation or network error
    const isExpectedCancellation = 
      errorObj?.isCancelled === true ||
      errorObj?.isExpected === true ||
      errorObj?.isBackground === true ||
      errorObj?.isNetworkError === true ||
      errorName === 'AbortError' ||
      errorName === 'TypeError' && (errorMessage.includes('Network request failed') || errorMessage.includes('network request failed') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) ||
      errorMessage.includes('Request cancelled') ||
      errorMessage.includes('request cancelled') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('App is in background') ||
      errorMessage.includes('app in background') ||
      errorMessage.includes('Network request failed') ||
      errorMessage.includes('network request failed') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('Failed to fetch') ||
      errorString.includes('Network request failed') ||
      errorString.includes('network request failed') ||
      errorString.includes('TypeError') && errorString.includes('Network');
    
    if (isExpectedCancellation) {
      // Suppress the error - this is expected behavior when app goes to background or network is unavailable
      event?.preventDefault?.();
      return;
    }
    
    // For other errors, use the original handler if it exists
    if (originalUnhandledRejection) {
      originalUnhandledRejection(event);
    }
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DeviceStatusProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="registration" options={{ headerShown: false }} />
          <Stack.Screen name="manualConnect" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
        <DeviceStatusBar />
      </DeviceStatusProvider>
    </ThemeProvider>
  );
}
