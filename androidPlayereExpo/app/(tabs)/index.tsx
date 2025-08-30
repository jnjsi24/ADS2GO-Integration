import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import * as Location from "expo-location";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import QRCode from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAds, AdDeployment } from "../../src/services/adsService";

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<AdDeployment[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);

  const loadAds = async (loc: Location.LocationObject) => {
    try {
      console.log('Loading ads for location:', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
      
      const activeAds = await fetchAds(loc.coords);
      console.log('Successfully loaded ads:', activeAds);
      
      setAds(activeAds);
      setError(null);
    } catch (err) {
      console.error('Error in loadAds:', {
        error: err instanceof Error ? {
          name: err.name,
          message: err.message,
          stack: err.stack
        } : err,
        timestamp: new Date().toISOString()
      });
      setError('Failed to load ads. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied");
          setLoading(false);
          return;
        }

        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        await AsyncStorage.setItem("lastLocation", JSON.stringify(loc.coords));
        
        // Load ads after getting location
        await loadAds(loc);
        
        // Set up location updates
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 100 },
          (newLocation) => {
            setLocation(newLocation);
            // Optional: Update ads when location changes significantly
            // loadAds(newLocation);
          }
        );

        return () => {
          if (subscription && 'remove' in subscription) {
            subscription.remove();
          }
        };
      } catch (err) {
        console.error('Error in location handling:', err);
        setError('Error getting location');
        setLoading(false);
      }
    })();
  }, []);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish) {
      // Move to next ad when current one finishes
      setCurrentAdIndex(prevIndex => (prevIndex + 1) % Math.max(1, ads.length));
    }
  };

  const currentAd = ads[currentAdIndex % Math.max(1, ads.length)];

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text>Loading player...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Android Player</Text>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {location && (
        <Text style={styles.text}>
          GPS: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
        </Text>
      )}

      <View style={styles.videoContainer}>
        {currentAd ? (
          <>
            <Video
              ref={videoRef}
              source={{ uri: currentAd.ad.mediaFile }}
              style={styles.video}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={(error) => {
                console.error('Video playback error:', error);
                // Skip to next video on error
                setCurrentAdIndex(prev => (prev + 1) % Math.max(1, ads.length));
              }}
            />
            <Text style={styles.adTitle}>{currentAd.ad.title}</Text>
          </>
        ) : (
          <View style={styles.noAdsContainer}>
            <Text>No ads available</Text>
            <Text style={styles.refreshText}>Pull down to refresh</Text>
          </View>
        )}
      </View>

      <View style={styles.qrContainer}>
        <QRCode 
          value={currentAd?.ad.id || 'https://ads2go.app'} 
          size={120} 
        />
        <Text style={styles.qrText}>Ad ID: {currentAd?.ad.id.substring(0, 8) || 'N/A'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  videoContainer: {
    width: '100%',
    height: 300,
    marginVertical: 20,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    color: '#666',
    marginVertical: 5,
  },
  adTitle: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 4,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  noAdsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  refreshText: {
    marginTop: 10,
    color: '#666',
    fontSize: 12,
  },
  qrContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  qrText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
});
