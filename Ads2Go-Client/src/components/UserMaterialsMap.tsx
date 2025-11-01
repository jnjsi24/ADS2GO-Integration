import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import * as L from 'leaflet';
import MapView from './MapView';
import { useQuery } from '@apollo/client';
import { GET_USER_MATERIALS_WITH_LOCATION } from '../graphql/user/queries/getUserMaterialsWithLocation';
import playbackWebSocketService from '../services/playbackWebSocketService';

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

  // Fetch materials with location
  // 🔄 Changed from 30s to 2s for smooth real-time updates (matches Admin Client)
  const { data, loading, error, refetch } = useQuery(GET_USER_MATERIALS_WITH_LOCATION, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 2000, // ✅ Refresh every 2 seconds (smooth, real-time updates)
    notifyOnNetworkStatusChange: false, // Silent refresh - no loading state during background updates
  });

  // Update materials when data changes
  useEffect(() => {
    if (data?.getUserMaterialsWithLocation?.materials) {
      const materialsData = data.getUserMaterialsWithLocation.materials;
      console.log('📍 [UserMaterialsMap] Received materials:', materialsData.length);
      setMaterials(materialsData);

      // Calculate map center from materials with valid locations
      const validLocations = materialsData.filter((m: MaterialWithLocation) => 
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
    }
  }, [data]);

  // WebSocket subscription for real-time location updates
  useEffect(() => {
    console.log('🔌 [UserMaterialsMap] Setting up WebSocket subscription');
    
    const unsubscribe = playbackWebSocketService.subscribe((update) => {
      if (update.type === 'locationUpdate' && update.deviceId && update.location) {
        console.log('📍 [UserMaterialsMap] Received location update:', update);
        
        // Update material location in state
        setMaterials((prevMaterials) => {
          return prevMaterials.map((material) => {
            // Check if this update is for one of the user's materials
            if (material.materialId === update.deviceId || 
                material.carGroupId === update.deviceId) {
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
                }
              };
            }
            return material;
          });
        });
      }
    });

    return () => {
      console.log('🔌 [UserMaterialsMap] Cleaning up WebSocket subscription');
      unsubscribe();
    };
  }, []);

  // Create custom icons for online/offline status
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
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'Never';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1b5087] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading map...</p>
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
        <div className="text-center p-4">
          <svg className="w-14 h-14 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-medium mb-1">No Active Materials</p>
          <p className="text-sm">
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
        {materialsWithLocation.map((material) => (
          <Marker
            key={material.materialId}
            position={[material.currentLocation!.lat, material.currentLocation!.lng]}
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
                  {material.currentLocation?.address && (
                    <p><strong>Location:</strong> {material.currentLocation.address}</p>
                  )}
                  <p><strong>Last Seen:</strong> {formatLastSeen(material.lastSeen)}</p>
                  {material.currentLocation?.speed !== undefined && (
                    <p><strong>Speed:</strong> {Math.round(material.currentLocation.speed)} km/h</p>
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
        ))}
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

