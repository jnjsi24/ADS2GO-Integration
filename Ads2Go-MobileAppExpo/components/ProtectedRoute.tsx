import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  if (state.isLoading) {
    // Show loading indicator while checking auth state
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!state.token) {
    // Redirect to login if not authenticated
    return <Redirect href="/(auth)/login" />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
