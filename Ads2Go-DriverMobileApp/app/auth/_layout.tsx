import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'card',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="emailVerification" options={{ title: 'Verify Email' }} />
      <Stack.Screen name="verificationProgress" options={{ title: 'Verification Status' }} />
      <Stack.Screen name="forgotPass" options={{ title: 'Reset Password' }} />
    </Stack>
  );
}
