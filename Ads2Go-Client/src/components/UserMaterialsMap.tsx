import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import * as L from 'leaflet';
import MapView from './MapView';
import { useQuery } from '@apollo/client';
import { GET_USER_MATERIALS_WITH_LOCATION } from '../graphql/user/queries/getUserMaterialsWithLocation';
import playbackWebSocketService from '../services/playbackWebSocketService';
import { screenComplianceService } from '../services/screenComplianceService';

// ✨ Client-side reverse geocoding helper with caching
const geocodingCache = new Map<string, string>();
const reverseGeocodeClient = async (lat: number, lng: number): Promise<string> => {
  // Round coordinates to 4 decimal places for caching (about 11m accuracy)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  // Check cache first
  if (geocodingCache.has(cacheKey)) {
    return geocodingCache.get(cacheKey)!;
  }
  
  try {
    // Use OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Ads2Go-UserClient/1.0' // Required by Nominatim
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.address) {
      const addr = data.address;
      const addressParts = [];
      
      // Build address from most specific to least specific
      if (addr.house_number) addressParts.push(addr.house_number);
      if (addr.road) addressParts.push(addr.road);
      if (addr.neighbourhood || addr.suburb) addressParts.push(addr.neighbourhood || addr.suburb);
      if (addr.city || addr.town || addr.village) addressParts.push(addr.city || addr.town || addr.village);
      if (addr.state) addressParts.push(addr.state);
      if (addr.country) addressParts.push(addr.country);
      
      const address = addressParts.join(', ') || `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      geocodingCache.set(cacheKey, address); // Cache the result
      return address;
    }
    
    const fallback = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    geocodingCache.set(cacheKey, fallback); // Cache fallback too
    return fallback;
  } catch (error) {
    console.warn('Client-side geocoding failed:', error);
    const fallback = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    geocodingCache.set(cacheKey, fallback); // Cache fallback too
    return fallback;
  }
};

interface MaterialLocation {
  lat?: number;
  lng?: number;
  timestamp?: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
  address?: string;
}

interface MaterialWithLocation {
  materialId: string;
  materialName?: string;
  materialType?: string;
  vehicleType?: string;
  category?: string;
  isOnline: boolean;
  lastSeen?: string;
  currentLocation?: MaterialLocation;
  totalAdPlays?: number;
  totalQRScans?: number;
  carGroupId?: string;
  screenType?: string;
  ads?: any[];
}

interface UserMaterialsMapProps {
  height?: string;
  className?: string;
}

const UserMaterialsMap: React.FC<UserMaterialsMapProps> = ({ 
  height = '300px',
  className = ''
}) => {
  const [materials, setMaterials] = useState<MaterialWithLocation[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]); // Manila default
  const [zoom, setZoom] = useState(12);
  const mapRef = useRef<L.Map | null>(null);
  const [deviceHoursMap, setDeviceHoursMap] = useState<Map<string, number>>(new Map()); // Map of materialId -> currentHours
  const [addressCache, setAddressCache] = useState<Map<string, string>>(new Map()); // Map of materialId -> address
  const [geocodingInProgress, setGeocodingInProgress] = useState<Set<string>>(new Set()); // Track materials being geocoded

  // Fetch materials with location
  // 🔄 Changed from 30s to 2s for smooth real-time updates (matches Admin Client)
  const { data, loading, error, refetch } = useQuery(GET_USER_MATERIALS_WITH_LOCATION, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 2000, // ✅ Refresh every 2 seconds (smooth, real-time updates)
    notifyOnNetworkStatusChange: false, // Silent refresh - no loading state during background updates
  });

  // Fetch device hours from compliance service to check if devices completed 8 hours
  useEffect(() => {
    const fetchDeviceHours = async () => {
      try {
        const complianceData = await screenComplianceService.getCompliance(null, false);
        if (complianceData.success && complianceData.data?.materialScreens) {
          const hoursMap = new Map<string, number>();
          complianceData.data.materialScreens.forEach((screen: any) => {
            if (screen.materialId && screen.totalHours) {
              hoursMap.set(screen.materialId, screen.totalHours);
            }
          });
          setDeviceHoursMap(hoursMap);
        }
      } catch (error) {
        console.error('Error fetching device hours for filtering:', error);
      }
    };
    
    fetchDeviceHours();
    // Refresh device hours every 30 seconds
    const interval = setInterval(fetchDeviceHours, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update materials when data changes
  useEffect(() => {
    if (data?.getUserMaterialsWithLocation?.materials) {
      const materialsData = data.getUserMaterialsWithLocation.materials;
      console.log('📍 [UserMaterialsMap] Received materials:', materialsData.length);
      
      // ✅ FILTER: Remove GPS data for devices that completed 8 hours (in company-ads-only mode)
      const newMaterialsFromPolling = materialsData.map((m: MaterialWithLocation) => {
        const deviceHours = deviceHoursMap.get(m.materialId || '');
        if (deviceHours !== undefined && deviceHours >= 8) {
          // Device completed 8 hours - remove GPS location for user client
          return {
            ...m,
            currentLocation: undefined, // Remove location but keep other data
            source: 'polling' as const
          };
        }
        return {
          ...m,
          source: 'polling' as const
        };
      });
      
      // ✅ SMART MERGE: Merge polling data with existing WebSocket data
      setMaterials(prevMaterials => {
        const mergedMaterials = new Map<string, MaterialWithLocation>();
        
        // First, add all existing materials (preserve WebSocket updates)
        prevMaterials.forEach(mat => {
          mergedMaterials.set(mat.materialId, mat);
        });
        
        // Then, merge new polling data (only update if newer or if material doesn't exist)
        newMaterialsFromPolling.forEach(newMat => {
          const existingMat = mergedMaterials.get(newMat.materialId);
          
          if (!existingMat) {
            // New material - add it
            mergedMaterials.set(newMat.materialId, newMat);
          } else {
            // Existing material - check timestamps
            const existingTimestamp = existingMat.currentLocation?.timestamp 
              ? new Date(existingMat.currentLocation.timestamp).getTime()
              : existingMat.lastSeen 
                ? new Date(existingMat.lastSeen).getTime()
                : 0;
            const newTimestamp = newMat.currentLocation?.timestamp
              ? new Date(newMat.currentLocation.timestamp).getTime()
              : newMat.lastSeen
                ? new Date(newMat.lastSeen).getTime()
                : 0;
            const existingSource = (existingMat as any).source || 'unknown';
            const isExistingFromWebSocket = existingSource === 'websocket';
            
            // ✅ PREFER WEBSOCKET: If existing is from WebSocket and polling is recent, ignore polling GPS
            if (isExistingFromWebSocket && newTimestamp - existingTimestamp < 5000 && existingMat.currentLocation) {
              // Keep existing WebSocket GPS (it's more recent)
              mergedMaterials.set(newMat.materialId, {
                ...existingMat,
                // Keep WebSocket GPS, but update other fields from polling
                isOnline: newMat.isOnline !== undefined ? newMat.isOnline : existingMat.isOnline,
                lastSeen: newMat.lastSeen || existingMat.lastSeen,
                source: existingSource // Keep WebSocket source
              });
              return;
            }
            
            // ✅ PREFER NEWER: If polling data is newer, use it (but preserve WebSocket GPS if recent)
            if (newTimestamp >= existingTimestamp) {
              const mergedMat: MaterialWithLocation = {
                ...existingMat,
                // Keep WebSocket GPS if it exists and is recent, otherwise use polling
                currentLocation: (isExistingFromWebSocket && existingMat.currentLocation && newTimestamp - existingTimestamp < 5000)
                  ? existingMat.currentLocation // Keep WebSocket GPS
                  : newMat.currentLocation, // Use polling GPS
                // Always update other fields from polling
                isOnline: newMat.isOnline !== undefined ? newMat.isOnline : existingMat.isOnline,
                lastSeen: newMat.lastSeen || existingMat.lastSeen,
                source: (existingMat as any).source || 'polling' // Keep original source
              };
              mergedMaterials.set(newMat.materialId, mergedMat);
            } else {
              // Existing data is newer - keep it
              return;
            }
          }
        });
        
        return Array.from(mergedMaterials.values());
      });

      // Map center calculation moved to separate effect below
    }
  }, [data, deviceHoursMap]);

  // Calculate map center from materials with valid locations (runs after materials state updates)
  useEffect(() => {
    const validLocations = materials.filter((m: MaterialWithLocation) => 
      m.currentLocation && 
      typeof m.currentLocation.lat === 'number' &&
      typeof m.currentLocation.lng === 'number' &&
      !isNaN(m.currentLocation.lat) &&
      !isNaN(m.currentLocation.lng) &&
      m.currentLocation.lat !== 0 &&
      m.currentLocation.lng !== 0 &&
      m.currentLocation.lat >= -90 &&
      m.currentLocation.lat <= 90 &&
      m.currentLocation.lng >= -180 &&
      m.currentLocation.lng <= 180
    );

    if (validLocations.length > 0) {
      const avgLat = validLocations.reduce((sum: number, m: MaterialWithLocation) => 
        sum + (m.currentLocation?.lat || 0), 0) / validLocations.length;
      const avgLng = validLocations.reduce((sum: number, m: MaterialWithLocation) => 
        sum + (m.currentLocation?.lng || 0), 0) / validLocations.length;
      
      console.log('📍 [UserMaterialsMap] Setting map center to:', [avgLat, avgLng]);
      setMapCenter([avgLat, avgLng]);
      
      // Adjust zoom based on number of materials
      if (validLocations.length === 1) {
        setZoom(15);
      } else if (validLocations.length <= 3) {
        setZoom(13);
      } else {
        setZoom(12);
      }
    }
  }, [materials]);

  // WebSocket subscription for real-time location updates
  useEffect(() => {
    console.log('🔌 [UserMaterialsMap] Setting up WebSocket subscription');
    
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      // Handle dedicated location updates (from screen tracking / location-update API)
      if (update.type === 'locationUpdate' && update.deviceId && update.location) {
        console.log('📍 [UserMaterialsMap] Received location update:', update);
        
        // ✅ FILTER: Check if device has completed 8 hours - don't update GPS for user client
        const materialId = update.deviceId || update.materialId;
        const deviceHours = deviceHoursMap.get(materialId || '');
        
        if (deviceHours !== undefined && deviceHours >= 8) {
          // Device is in company-ads-only mode - don't track GPS for user client
          console.log(`🚫 [UserMaterialsMap] Device ${materialId} completed 8 hours - filtering GPS update`);
          return;
        }
        
        // Update material location in state
        setMaterials((prevMaterials) => {
          return prevMaterials.map((material) => {
            // Check if this update is for one of the user's materials
            if (material.materialId === update.deviceId || 
                material.carGroupId === update.deviceId) {
              
              // Double-check device hours before updating GPS
              const matHours = deviceHoursMap.get(material.materialId || '');
              if (matHours !== undefined && matHours >= 8) {
                // Device completed 8 hours - don't update GPS
                return {
                  ...material,
                  isOnline: true,
                  lastSeen: new Date().toISOString()
                  // Keep existing location (or undefined if already filtered)
                };
              }
              
              console.log(`📍 [UserMaterialsMap] Updating location for ${material.materialId}`);
              return {
                ...material,
                isOnline: true,
                lastSeen: new Date().toISOString(),
                currentLocation: {
                  lat: update.location.lat,
                  lng: update.location.lng,
                  timestamp: update.location.timestamp || new Date().toISOString(),
                  speed: update.location.speed,
                  heading: update.location.heading,
                  accuracy: update.location.accuracy,
                  address: update.location.address
                },
                source: 'websocket' as const // Mark as WebSocket update
              };
            }
            return material;
          });
        });
        return;
      }

      // Handle GPS from playback updates (device sends gpsData with ad playback)
      if (update.type === 'adPlaybackUpdate' && update.gpsData && (update.deviceId || update.materialId)) {
        const gps = update.gpsData;
        const lat = gps.lat;
        const lng = gps.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) return;

        const deviceHours = deviceHoursMap.get(update.materialId || update.deviceId || '');
        if (deviceHours !== undefined && deviceHours >= 8) return;

        setMaterials((prevMaterials) => {
          return prevMaterials.map((material) => {
            const matches = material.materialId === update.materialId ||
              material.materialId === update.deviceId ||
              material.carGroupId === update.deviceId;
            if (!matches) return material;

            const matHours = deviceHoursMap.get(material.materialId || '');
            if (matHours !== undefined && matHours >= 8) {
              return { ...material, isOnline: true, lastSeen: new Date().toISOString() };
            }

            const timestamp = gps.timestamp || new Date().toISOString();
            const speedMs = typeof gps.speed === 'number' ? gps.speed : 0;
            return {
              ...material,
              isOnline: true,
              lastSeen: new Date().toISOString(),
              currentLocation: {
                lat,
                lng,
                timestamp,
                speed: speedMs * 3.6,
                heading: gps.heading,
                accuracy: gps.accuracy,
                address: undefined
              },
              source: 'websocket' as const
            };
          });
        });
      }
    });

    return () => {
      console.log('🔌 [UserMaterialsMap] Cleaning up WebSocket subscription');
      unsubscribe();
    };
  }, []);

  // Create custom icons for online/offline status (car icon for advertisement vehicles)
  const createCustomIcon = (isOnline: boolean) => {
    const iconColor = isOnline ? '#22c55e' : '#ef4444'; // green for online, red for offline
    
    return L.divIcon({
      className: 'custom-material-marker',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: ${iconColor};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  const formatLastSeen = (timestamp?: string | Date) => {
    if (!timestamp) return 'Never';
    
    try {
      const now = new Date();
      // Handle both string and Date objects
      const lastSeenDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(lastSeenDate.getTime())) {
        console.warn('Invalid timestamp provided to formatLastSeen:', timestamp);
        return 'Unknown';
      }
      
      const diffInMilliseconds = now.getTime() - lastSeenDate.getTime();
      const diffInMinutes = Math.floor(diffInMilliseconds / (1000 * 60));
      
      // Handle negative differences (future dates)
      if (diffInMinutes < 0) return 'Just now';
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch (error) {
      console.error('Error formatting last seen:', error, timestamp);
      return 'Unknown';
    }
  };
  
  // Helper function to format GPS coordinates
  const formatCoordinates = (lat?: number, lng?: number): string => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return 'N/A';
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };
  
  // Helper function to get the best timestamp for display
  const getDisplayTimestamp = (material: MaterialWithLocation): string | undefined => {
    // ✅ FIX: If online and has currentLocation with timestamp, prefer that (most accurate)
    if (material.isOnline && material.currentLocation?.timestamp) {
      return material.currentLocation.timestamp;
    }
    // Otherwise, use lastSeen
    return material.lastSeen;
  };

  // Helper function to get address for a material (with geocoding if needed)
  const getMaterialAddress = useCallback(async (material: MaterialWithLocation): Promise<string | null> => {
    if (!material.currentLocation?.lat || !material.currentLocation?.lng) {
      return null;
    }

    const materialId = material.materialId;
    const lat = material.currentLocation.lat;
    const lng = material.currentLocation.lng;

    // Check if we already have an address in the material's currentLocation
    if (material.currentLocation.address && !material.currentLocation.address.startsWith('Location:')) {
      // Update cache with the address from server
      setAddressCache(prev => {
        const newCache = new Map(prev);
        newCache.set(materialId, material.currentLocation!.address!);
        return newCache;
      });
      return material.currentLocation.address;
    }

    // Check cache
    if (addressCache.has(materialId)) {
      return addressCache.get(materialId)!;
    }

    // Check if geocoding is already in progress for this material
    if (geocodingInProgress.has(materialId)) {
      return null; // Return null to indicate address is loading
    }

    // Start geocoding
    setGeocodingInProgress(prev => new Set(prev).add(materialId));
    
    try {
      const address = await reverseGeocodeClient(lat, lng);
      setAddressCache(prev => {
        const newCache = new Map(prev);
        newCache.set(materialId, address);
        return newCache;
      });
      return address;
    } catch (error) {
      console.warn(`Failed to geocode ${materialId}:`, error);
      return null;
    } finally {
      setGeocodingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(materialId);
        return newSet;
      });
    }
  }, [addressCache, geocodingInProgress]);

  // Geocode addresses for materials when they change
  useEffect(() => {
    const geocodeMaterials = async () => {
      const materialsToGeocode: MaterialWithLocation[] = [];
      
      // First pass: update cache with server addresses and identify materials that need geocoding
      setAddressCache(prevCache => {
        const newCache = new Map(prevCache);
        
        for (const material of materials) {
          if (material.currentLocation?.lat && material.currentLocation?.lng) {
            const materialId = material.materialId;
            const serverAddress = material.currentLocation.address;
            
            // If server has a valid address, cache it
            if (serverAddress && !serverAddress.startsWith('Location:')) {
              if (!newCache.has(materialId)) {
                newCache.set(materialId, serverAddress);
              }
            } else if (!newCache.has(materialId)) {
              // Need to geocode this material
              materialsToGeocode.push(material);
            }
          }
        }
        
        return newCache;
      });
      
      // Second pass: geocode materials that need it
      for (const material of materialsToGeocode) {
        const materialId = material.materialId;
        
        // Check if already geocoding
        setGeocodingInProgress(prev => {
          if (prev.has(materialId)) {
            return prev; // Already geocoding
          }
          
          const newProgress = new Set(prev);
          newProgress.add(materialId);
          
          // Start geocoding
          reverseGeocodeClient(material.currentLocation!.lat!, material.currentLocation!.lng!)
            .then(address => {
              setAddressCache(prev => {
                const updated = new Map(prev);
                updated.set(materialId, address);
                return updated;
              });
            })
            .catch(error => {
              console.warn(`Failed to geocode material ${materialId}:`, error);
              // Cache coordinates as fallback
              const fallback = `Location: ${material.currentLocation!.lat!.toFixed(6)}, ${material.currentLocation!.lng!.toFixed(6)}`;
              setAddressCache(prev => {
                const updated = new Map(prev);
                updated.set(materialId, fallback);
                return updated;
              });
            })
            .finally(() => {
              setGeocodingInProgress(prev => {
                const updated = new Set(prev);
                updated.delete(materialId);
                return updated;
              });
            });
          
          return newProgress;
        });
      }
    };

    geocodeMaterials();
  }, [materials]); // Only depend on materials

  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1b5087] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading map</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={`bg-red-50 border border-red-200 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center p-4">
          <p className="text-red-600 font-medium mb-2">Error loading materials</p>
          <p className="text-red-500 text-sm mb-3">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Helper function to validate location
  const hasValidLocation = (m: MaterialWithLocation) => {
    return m.currentLocation && 
           typeof m.currentLocation.lat === 'number' &&
           typeof m.currentLocation.lng === 'number' &&
           !isNaN(m.currentLocation.lat) &&
           !isNaN(m.currentLocation.lng) &&
           m.currentLocation.lat !== 0 && 
           m.currentLocation.lng !== 0 &&
           m.currentLocation.lat >= -90 &&
           m.currentLocation.lat <= 90 &&
           m.currentLocation.lng >= -180 &&
           m.currentLocation.lng <= 180;
  };

  const materialsWithLocation = materials.filter(hasValidLocation);

  if (materialsWithLocation.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center text-black/70 p-4">
          <svg className="w-14 h-14 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-medium text-black/90 mb-1">No Active Materials</p>
          <p className="text-sm text-black/70">
            Your materials will appear here when they're online and sending location data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <MapView
        center={mapCenter}
        zoom={zoom}
        onMapLoad={(map) => {
          mapRef.current = map;
          console.log('📍 [UserMaterialsMap] Map loaded');
        }}
        style={{ height: '100%', width: '100%' }}
      >
        {materialsWithLocation.map((material) => {
          // ✅ VERIFY: Ensure marker position matches displayed coordinates
          const markerLat = material.currentLocation!.lat;
          const markerLng = material.currentLocation!.lng;
          const displayCoords = formatCoordinates(markerLat, markerLng);
          
          // Log for debugging (only in development)
          if (process.env.NODE_ENV === 'development') {
            console.log(`📍 [UserMaterialsMap] Marker for ${material.materialId}:`, {
              markerPosition: [markerLat, markerLng],
              displayCoords: displayCoords,
              isOnline: material.isOnline,
              timestamp: getDisplayTimestamp(material)
            });
          }
          
          return (
            <Marker
              key={material.materialId}
              position={[markerLat, markerLng]}
              icon={createCustomIcon(material.isOnline)}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900">{material.materialName || material.materialId}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      material.isOnline 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {material.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <p><strong>Type:</strong> {material.materialType}</p>
                    <p><strong>Vehicle:</strong> {material.vehicleType}</p>
                    
                    {/* ✅ FIX: Show address instead of GPS coordinates */}
                    {material.currentLocation && (
                      <div className="space-y-1">
                        {(() => {
                          // Get address from cache or material's currentLocation
                          const cachedAddress = addressCache.get(material.materialId);
                          const address = cachedAddress || material.currentLocation.address;
                          
                          // Show address if available and not just coordinates
                          if (address && !address.startsWith('Location:')) {
                            return <p><strong>Address:</strong> {address}</p>;
                          }
                          
                          // Show coordinates as fallback if address is not available
                          return <p><strong>Location:</strong> {displayCoords}</p>;
                        })()}
                      </div>
                    )}
                    
                    {/* ✅ FIX: Show "Current Location" if online, "Last Seen" if offline */}
                    {material.isOnline ? (
                      <p><strong>Current Location:</strong> {formatLastSeen(getDisplayTimestamp(material))}</p>
                    ) : (
                      <p><strong>Last Seen:</strong> {formatLastSeen(getDisplayTimestamp(material))}</p>
                    )}
                    
                    {material.currentLocation?.speed !== undefined && material.currentLocation.speed > 0 && (
                      <p><strong>Speed:</strong> {Math.round(material.currentLocation.speed)} km/h</p>
                    )}
                    {material.currentLocation?.accuracy !== undefined && (
                      <p><strong>Accuracy:</strong> {Math.round(material.currentLocation.accuracy)}m</p>
                    )}
                  </div>

                {material.ads && material.ads.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Active Ads:</p>
                    <div className="space-y-1">
                      {material.ads.slice(0, 2).map((ad) => (
                        <div key={ad.adId} className="text-xs text-gray-600">
                          • {ad.adTitle}
                        </div>
                      ))}
                      {material.ads.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{material.ads.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-2 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{material.totalAdPlays || 0}</p>
                    <p className="text-gray-600">Ad Plays</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{material.totalQRScans || 0}</p>
                    <p className="text-gray-600">QR Scans</p>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
          );
        })}
      </MapView>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white px-4 py-2 shadow-sm rounded-md z-[1000]">
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Online</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Offline</span>
          </div>
          <div className="text-gray-500">
            {materialsWithLocation.length} / {materials.length} materials
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserMaterialsMap;

