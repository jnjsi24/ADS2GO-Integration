import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function IndexScreen() {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect based on authentication state
    if (!state.isLoading) {
      if (state.token) {
        // User is authenticated, go to dashboard
        router.replace('/tabs/dashboard');
      } else {
        // User is not authenticated, go to login
        router.replace('/auth/login');
      }
    }
  }, [state.token, state.isLoading]);

  // Show loading screen while determining auth state
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#ffffff'
    }}>
      <ActivityIndicator size="large" color="#3674B5" />
    </View>
  );
}
