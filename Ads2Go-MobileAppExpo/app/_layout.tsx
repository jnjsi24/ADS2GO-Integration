//LAYOUT

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null; // Wait for fonts to load
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack
        screenOptions={{ headerShown: false }}
        initialRouteName="(auth)/login" // 👈 Force login screen first
      >
        {/* Auth Screens */}
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
        
        {/* Main App Tabs (only after login) */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>

      {/* Dark text for status bar */}
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}