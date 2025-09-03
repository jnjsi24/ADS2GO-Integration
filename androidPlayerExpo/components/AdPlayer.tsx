import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Ad } from '../services/tabletRegistration';

interface AdPlayerProps {
  materialId: string;
  slotNumber: number;
  onAdError?: (error: string) => void;
}

const AdPlayer: React.FC<AdPlayerProps> = ({ materialId, slotNumber, onAdError }) => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<boolean>(true);
  const videoRef = useRef<Video>(null);

  // Cache key for storing ads locally
  const getCacheKey = () => `ads_${materialId}_${slotNumber}`;

  // Check network connectivity
  const checkNetworkStatus = async () => {
    try {
      const state = await NetInfo.fetch();
      const isConnected = state.isConnected && state.isInternetReachable;
      setNetworkStatus(isConnected || false);
      return isConnected;
    } catch (err) {
      console.error('Error checking network status:', err);
      // Fallback: assume we're online and let the fetch attempt determine connectivity
      return true;
    }
  };

  // Load cached ads from local storage
  const loadCachedAds = async () => {
    try {
      const cacheKey = getCacheKey();
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedAds = JSON.parse(cachedData);
        
        // Validate cached ads as well
        const validCachedAds = await filterValidAds(parsedAds);
        
        if (validCachedAds.length > 0) {
          setAds(validCachedAds);
          setCurrentAdIndex(0);
          console.log('Loaded valid cached ads:', validCachedAds.length);
          return true;
        } else {
          console.log('No valid cached ads found, clearing cache');
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (err) {
      console.error('Error loading cached ads:', err);
    }
    return false;
  };

  // Save ads to local storage
  const saveAdsToCache = async (adsToCache: Ad[]) => {
    try {
      const cacheKey = getCacheKey();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(adsToCache));
      console.log('Saved ads to cache:', adsToCache.length);
    } catch (err) {
      console.error('Error saving ads to cache:', err);
    }
  };

  // Check if we have cached ads available
  const hasCachedAds = () => {
    return ads.length > 0;
  };

  // Validate video URL before attempting playback
  const validateVideoUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.log('Video URL validation failed:', url, error);
      return false;
    }
  };

  // Filter out invalid ads
  const filterValidAds = async (adsToFilter: Ad[]): Promise<Ad[]> => {
    const validAds: Ad[] = [];
    
    for (const ad of adsToFilter) {
      if (ad.mediaFile && ad.mediaFile.trim() !== '') {
        const isValid = await validateVideoUrl(ad.mediaFile);
        if (isValid) {
          validAds.push(ad);
        } else {
          console.log('Skipping invalid video URL:', ad.mediaFile);
        }
      }
    }
    
    console.log(`Filtered ${adsToFilter.length} ads to ${validAds.length} valid ads`);
    return validAds;
  };

  // Import the service dynamically to avoid circular dependencies
  const fetchAds = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsOffline(false);
      
      // Check network status first
      const isConnected = await checkNetworkStatus();
      if (!isConnected) {
        console.log('Network is offline, loading cached ads');
        const hasCached = await loadCachedAds();
        if (hasCached) {
          setIsOffline(true);
          setLoading(false);
          return;
        } else {
          setError('No internet connection and no cached ads available');
          setLoading(false);
          return;
        }
      }
      
      const { default: tabletRegistrationService } = await import('../services/tabletRegistration');
      const result = await tabletRegistrationService.fetchAds(materialId, slotNumber);
      
      if (result.success && result.ads.length > 0) {
        // Filter out invalid ads before setting state
        const validAds = await filterValidAds(result.ads);
        
        if (validAds.length > 0) {
          setAds(validAds);
          setCurrentAdIndex(0);
          console.log('Loaded valid ads from server:', validAds.length);
          
          // Cache the valid ads for offline use
          await saveAdsToCache(validAds);
        } else {
          console.log('No valid ads found after filtering');
          // Try to load cached ads if server has no valid ads
          const hasCached = await loadCachedAds();
          if (!hasCached) {
            setError('No valid ads available');
            if (onAdError) {
              onAdError('No valid ads available');
            }
          }
        }
      } else {
        // Try to load cached ads if server has no ads
        const hasCached = await loadCachedAds();
        if (!hasCached) {
          setError(result.message || 'No ads available');
          if (onAdError) {
            onAdError(result.message || 'No ads available');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching ads from server:', err);
      
      // Network error - try to load cached ads
      const hasCached = await loadCachedAds();
      if (hasCached) {
        setIsOffline(true);
        console.log('Using cached ads in offline mode');
      } else {
        const errorMessage = 'Failed to fetch ads and no cached ads available';
        setError(errorMessage);
        if (onAdError) {
          onAdError(errorMessage);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Monitor network status changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      setNetworkStatus(isConnected || false);
      
      // If we regain connection and we're in offline mode, try to refresh
      if (isConnected && isOffline) {
        console.log('Network restored, attempting to refresh ads');
        fetchAds();
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  useEffect(() => {
    fetchAds();
  }, [materialId, slotNumber]);

  // Company ad data (Ads2Go branding)
  const companyAd = {
    adId: 'company-ad',
    adTitle: 'Ads2Go',
    mediaFile: 'https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.appspot.com/o/advertisements%2Fcomapanyads.mp4?alt=media',
    duration: 15
  };

  // Determine which ad to show
  const currentAd = currentAdIndex === -1 ? companyAd : (ads[currentAdIndex] || null);
  
  // Debug logging
  console.log('Current ad:', {
    currentAdIndex,
    isCompanyAd: currentAdIndex === -1,
    adTitle: currentAd?.adTitle || 'No ad',
    mediaFile: currentAd?.mediaFile || 'No media',
    totalAds: ads.length,
    isOffline,
    networkStatus
  });

  const handleVideoEnd = () => {
    // If slots are not full (less than 5 ads), include company ads in rotation
    if (ads.length < 5) {
      // If currently showing a user ad
      if (currentAdIndex >= 0) {
        // If this is the last user ad, show company ad next
        if (currentAdIndex === ads.length - 1) {
          setCurrentAdIndex(-1); // Show company ad next
        } else {
          setCurrentAdIndex(currentAdIndex + 1); // Show next user ad
        }
      } else {
        // Currently showing company ad, go back to first user ad
        setCurrentAdIndex(0);
      }
    } else {
      // All 5 slots are full: cycle through user ads only
      if (currentAdIndex < ads.length - 1) {
        setCurrentAdIndex(currentAdIndex + 1);
      } else {
        setCurrentAdIndex(0); // Loop back to first ad
      }
    }
  };

  const handleVideoError = (error: any) => {
    console.error('Video playback error:', error);
    
    // Try to get more specific error information
    let errorMessage = 'Failed to play video';
    if (error && error.error && error.error.message) {
      errorMessage = `Video error: ${error.error.message}`;
    } else if (error && error.message) {
      errorMessage = `Video error: ${error.message}`;
    }
    
    console.log('Ad Player Error:', errorMessage);
    
    // If this is a network error (404, etc.), try to skip to next ad
    if (errorMessage.includes('404') || errorMessage.includes('Response code')) {
      console.log('Network error detected, attempting to skip to next ad...');
      setTimeout(() => {
        handleVideoEnd(); // Skip to next ad
      }, 1000);
      return;
    }
    
    setError(errorMessage);
    if (onAdError) {
      onAdError(errorMessage);
    }
  };

  const handleRefresh = () => {
    fetchAds();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading advertisements...</Text>
        </View>
      </View>
    );
  }

  if (error || !currentAd || ads.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#e74c3c" />
          <Text style={styles.errorTitle}>No Ads Available</Text>
          <Text style={styles.errorText}>
            {error || 'No advertisements are currently scheduled for this slot.'}
          </Text>
          <Text style={styles.errorSubtext}>
            This could be due to:
          </Text>
          <Text style={styles.errorSubtext}>
            • No ads scheduled for this time slot
          </Text>
          <Text style={styles.errorSubtext}>
            • Network connectivity issues
          </Text>
          <Text style={styles.errorSubtext}>
            • Invalid material ID or slot number
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Offline Indicator */}
      {isOffline && (
        <View style={styles.offlineIndicator}>
          <Ionicons name="wifi-outline" size={16} color="#f39c12" />
          <Text style={styles.offlineText}>Offline Mode - Using Cached Ads</Text>
        </View>
      )}
      
      <View style={styles.videoContainer}>
        <Video
          key={currentAd?.adId || 'no-ad'} // Force re-render when switching between user and company ads
          ref={videoRef}
          source={{ uri: currentAd?.mediaFile || '' }}
          style={styles.video}
          useNativeControls={false}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying || false);
              if (status.didJustFinish) {
                handleVideoEnd();
              }
            }
          }}
          onError={handleVideoError}
          onLoadStart={() => {
            console.log('Video loading started:', currentAd?.mediaFile);
          }}
          onLoad={() => {
            console.log('Video loaded successfully:', currentAd?.mediaFile);
          }}
          onReadyForDisplay={() => {
            console.log('Video ready for display:', currentAd?.mediaFile);
          }}
        />
        
        {/* Minimal Ad Info Overlay */}
        <View style={styles.adInfoOverlay}>
          <Text style={styles.adTitle}>{currentAd?.adTitle || 'No Ad'}</Text>
        </View>

        {/* Ad Counter */}
        <View style={styles.adCounter}>
          <Text style={styles.adCounterText}>
            {currentAdIndex === -1 ? 'Company' : `${currentAdIndex + 1}/${ads.length < 5 ? ads.length + 1 : ads.length}`}
          </Text>
        </View>
      </View>

      {/* Minimal Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={16} color="#3498db" />
          <Text style={styles.controlButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  errorTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#bdc3c7',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorSubtext: {
    color: '#95a5a6',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  adInfoOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 6,
  },
  adTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  adCounter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adCounterText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3498db',
    gap: 6,
  },
  controlButtonText: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default AdPlayer;
