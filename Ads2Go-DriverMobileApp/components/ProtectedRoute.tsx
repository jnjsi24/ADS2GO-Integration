import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, View, StyleSheet, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Video } from 'expo-av';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  if (state.isLoading) {
    // Show video loader while checking auth state
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/images/Video-Ads2Go-Wave-unscreen.gif')}
          style={styles.video}
        />
        {/* Fallback loader if video fails to load */}
        <View style={styles.fallbackContainer}>
          <ActivityIndicator size="large" color="#1B5087" />
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  video: {
    width: 240,
    height: 240,
  },
  fallbackContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
