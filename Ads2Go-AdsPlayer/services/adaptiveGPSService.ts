import * as Location from 'expo-location';
import { log } from '../utils/logger';

/**
 * Adaptive GPS Service
 * Intelligently adjusts GPS update frequency based on:
 * - Vehicle speed (faster = more frequent updates)
 * - Ad playback state (playing = more frequent)
 * - Movement status (stationary = less frequent)
 * - Battery optimization
 */

interface GPSData {
  lat: number;
  lng: number;
  speed: number;      // meters per second
  heading: number;    // degrees (0-360)
  accuracy: number;   // meters
  altitude?: number;  // meters
  timestamp: string;  // ISO string
}

interface GPSConfig {
  minInterval: number;    // Minimum update interval (ms)
  maxInterval: number;    // Maximum update interval (ms)
  isAdPlaying: boolean;   // Is an ad currently playing
  currentSpeed: number;   // Current vehicle speed (m/s)
}

class AdaptiveGPSService {
  private currentGPS: GPSData | null = null;
  private lastGPSUpdate: number = 0;
  private locationWatcher: Location.LocationSubscription | null = null;
  private currentInterval: number = 5000; // Default 5 seconds
  private isTracking: boolean = false;
  
  // Callback for when new GPS data is available
  private onGPSUpdate: ((gps: GPSData) => void) | null = null;

  /**
   * Calculate optimal GPS update interval based on context
   */
  private calculateOptimalInterval(config: GPSConfig): number {
    const { isAdPlaying, currentSpeed, minInterval, maxInterval } = config;
    
    // Speed in km/h for easier logic
    const speedKmh = currentSpeed * 3.6;
    
    // When ad is playing, prioritize accuracy
    if (isAdPlaying) {
      if (speedKmh > 60) {
        return 1000; // 1 second - highway speed
      } else if (speedKmh > 30) {
        return 2000; // 2 seconds - city speed
      } else if (speedKmh > 5) {
        return 3000; // 3 seconds - slow movement
      } else {
        return 5000; // 5 seconds - stationary with ad playing
      }
    }
    
    // When ad is NOT playing, reduce frequency
    if (speedKmh > 40) {
      return 5000;  // 5 seconds - moving fast, no ad
    } else if (speedKmh > 10) {
      return 7000;  // 7 seconds - moving slow
    } else {
      return 10000; // 10 seconds - stationary, no ad
    }
  }

  /**
   * Start GPS tracking with adaptive frequency
   */
  async startTracking(
    onUpdate: (gps: GPSData) => void,
    config: Partial<GPSConfig> = {}
  ): Promise<boolean> {
    try {
      // Check if already tracking
      if (this.isTracking) {
        console.log('📍 [AdaptiveGPS] Already tracking');
        return true;
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('📍 [AdaptiveGPS] Location permission denied');
        return false;
      }

      // ✅ FIX: Check location services availability before starting tracking
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          console.log('📍 [AdaptiveGPS] Location services disabled - cannot start tracking');
          return false;
        }
      } catch (servicesCheckError) {
        // If we can't check services, continue anyway
      }

      this.onGPSUpdate = onUpdate;
      this.isTracking = true;

      // ✅ FIX: Start location watching with error handling
      try {
        // Start location watching with high accuracy
        this.locationWatcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,     // Check every 1 second
            distanceInterval: 1,    // Or when moved 1 meter
          },
          (location) => {
            // ✅ FIX: Handle location errors in callback
            try {
              this.handleLocationUpdate(location, config);
            } catch (updateError: any) {
              // Handle errors in location update callback gracefully
              const errorMessage = updateError?.message || String(updateError);
              if (!errorMessage.includes('kCLErrorDomain') && 
                  !errorMessage.includes('Cannot obtain current location')) {
                console.warn('📍 [AdaptiveGPS] Error in location update callback:', errorMessage);
              }
            }
          }
        );

        console.log('📍 [AdaptiveGPS] Started adaptive GPS tracking');
        return true;
      } catch (watchError: any) {
        // ✅ FIX: Handle CoreLocation errors when starting watchPositionAsync
        this.isTracking = false;
        const errorMessage = watchError?.message || String(watchError);
        const errorCode = watchError?.code;
        
        if (errorMessage.includes('kCLErrorDomain') || 
            errorMessage.includes('Cannot obtain current location') ||
            errorCode === 0) {
          // GPS unavailable - this is normal in some situations
          console.log('📍 [AdaptiveGPS] GPS unavailable - cannot start tracking (this is normal)');
        } else {
          console.error('📍 [AdaptiveGPS] Error starting tracking:', errorMessage);
        }
        return false;
      }
    } catch (error: any) {
      // ✅ FIX: Handle general errors gracefully
      this.isTracking = false;
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code;
      
      if (errorMessage.includes('kCLErrorDomain') || 
          errorMessage.includes('Cannot obtain current location') ||
          errorCode === 0) {
        console.log('📍 [AdaptiveGPS] GPS unavailable - cannot start tracking');
      } else {
        console.error('📍 [AdaptiveGPS] Error starting tracking:', errorMessage);
      }
      return false;
    }
  }

  /**
   * Handle incoming location updates with smart throttling
   */
  private handleLocationUpdate(
    location: Location.LocationObject,
    config: Partial<GPSConfig>
  ) {
    // ✅ FIX: Validate location data before processing
    if (!location || !location.coords) {
      // Invalid location data - skip this update
      return;
    }

    // ✅ FIX: Validate coordinates (check for NaN, null, or invalid values)
    if (typeof location.coords.latitude !== 'number' || 
        typeof location.coords.longitude !== 'number' ||
        isNaN(location.coords.latitude) || 
        isNaN(location.coords.longitude)) {
      // Invalid coordinates - skip this update
      return;
    }

    const now = Date.now();
    
    // Calculate optimal interval
    const defaultConfig: GPSConfig = {
      minInterval: 1000,
      maxInterval: 10000,
      isAdPlaying: false,
      currentSpeed: location.coords.speed || 0,
      ...config
    };
    
    const optimalInterval = this.calculateOptimalInterval(defaultConfig);
    
    // Throttle updates based on optimal interval
    if (now - this.lastGPSUpdate < optimalInterval) {
      return; // Skip this update
    }

    // Create GPS data object
    const gpsData: GPSData = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      speed: location.coords.speed && location.coords.speed >= 0 ? location.coords.speed : 0,
      heading: location.coords.heading || 0,
      accuracy: location.coords.accuracy || 0,
      altitude: location.coords.altitude || undefined,
      timestamp: new Date(location.timestamp).toISOString()
    };

    // Update current GPS data
    this.currentGPS = gpsData;
    this.lastGPSUpdate = now;
    this.currentInterval = optimalInterval;

    // Log GPS quality occasionally
    if (Math.random() < 0.1) { // 10% of updates
      log.deviceTracking('GPS Update', {
        interval: `${optimalInterval}ms`,
        speed: `${(gpsData.speed * 3.6).toFixed(1)} km/h`,
        accuracy: `${gpsData.accuracy.toFixed(1)}m`,
        lat: gpsData.lat.toFixed(6),
        lng: gpsData.lng.toFixed(6)
      });
    }

    // Call callback with new GPS data
    if (this.onGPSUpdate) {
      this.onGPSUpdate(gpsData);
    }
  }

  /**
   * Update configuration (e.g., when ad starts/stops playing)
   */
  updateConfig(config: Partial<GPSConfig>) {
    // Configuration will be applied on next location update
    const newInterval = this.calculateOptimalInterval({
      minInterval: 1000,
      maxInterval: 10000,
      isAdPlaying: config.isAdPlaying || false,
      currentSpeed: this.currentGPS?.speed || 0,
      ...config
    });

    if (newInterval !== this.currentInterval) {
      console.log(`📍 [AdaptiveGPS] Interval changed: ${this.currentInterval}ms → ${newInterval}ms`);
      this.currentInterval = newInterval;
    }
  }

  /**
   * Get current GPS data (latest cached value)
   */
  getCurrentGPS(): GPSData | null {
    return this.currentGPS;
  }

  /**
   * Get current update interval
   */
  getCurrentInterval(): number {
    return this.currentInterval;
  }

  /**
   * Check if GPS tracking is active
   */
  isActive(): boolean {
    return this.isTracking;
  }

  /**
   * Stop GPS tracking
   */
  async stopTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }

    this.isTracking = false;
    this.onGPSUpdate = null;
    console.log('📍 [AdaptiveGPS] Stopped GPS tracking');
  }

  /**
   * Force immediate GPS update (useful for events like QR scans)
   */
  async forceUpdate(): Promise<GPSData | null> {
    try {
      // ✅ FIX: Check location services availability first
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.log('📍 [AdaptiveGPS] Location services disabled - cannot force update');
        return null;
      }

      // ✅ FIX: Try with high accuracy first, fallback to balanced if that fails
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: false,
        });
      } catch (highAccuracyError: any) {
        // If high accuracy fails, try with balanced accuracy (more reliable)
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            mayShowUserSettingsDialog: false,
          });
        } catch (balancedError: any) {
          // Both attempts failed - check if it's a CoreLocation error
          const errorMessage = balancedError?.message || String(balancedError);
          const errorCode = balancedError?.code;
          
          if (errorMessage.includes('kCLErrorDomain') || 
              errorMessage.includes('Cannot obtain current location') ||
              errorCode === 0) {
            // GPS unavailable - this is normal in some situations
            console.log('📍 [AdaptiveGPS] GPS unavailable - cannot force update (this is normal)');
          } else {
            console.warn('📍 [AdaptiveGPS] Error forcing GPS update:', errorMessage);
          }
          return null;
        }
      }

      if (!location || !location.coords) {
        return null;
      }

      const gpsData: GPSData = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        speed: location.coords.speed && location.coords.speed >= 0 ? location.coords.speed : 0,
        heading: location.coords.heading || 0,
        accuracy: location.coords.accuracy || 0,
        altitude: location.coords.altitude || undefined,
        timestamp: new Date(location.timestamp).toISOString()
      };

      this.currentGPS = gpsData;
      this.lastGPSUpdate = Date.now();

      console.log('📍 [AdaptiveGPS] Forced GPS update:', gpsData);
      return gpsData;
    } catch (error: any) {
      // ✅ FIX: Handle errors gracefully - don't log CoreLocation errors as errors
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code;
      
      if (errorMessage.includes('kCLErrorDomain') || 
          errorMessage.includes('Cannot obtain current location') ||
          errorCode === 0) {
        // GPS unavailable - normal, don't log as error
        console.log('📍 [AdaptiveGPS] GPS unavailable - cannot force update');
      } else {
        console.warn('📍 [AdaptiveGPS] Error forcing GPS update:', errorMessage);
      }
      return null;
    }
  }
}

export default new AdaptiveGPSService();

