import React, { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker, MapContainerProps } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

// Define types for the component props
interface MapViewProps extends MapContainerProps {
  center: [number, number];
  zoom: number;
  onMapLoad?: (map: L.Map) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Fix for default markers in development
if (process.env.NODE_ENV === 'development') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/images/marker-icon-2x.png',
    iconUrl: '/images/marker-icon.png',
    shadowUrl: '/images/marker-shadow.png',
  });
}


const MapView: React.FC<MapViewProps> = ({
  center,
  zoom,
  onMapLoad,
  children,
  style = { height: '100%', width: '100%' },
  className = '',
  ...rest
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapInitialized = useRef(false);
  const [isClient, setIsClient] = React.useState(false);

  // Handle map initialization
  const handleMapCreated = useCallback((map: L.Map) => {
    if (!mapInitialized.current) {
      mapRef.current = map;
      mapInitialized.current = true;
      if (onMapLoad) onMapLoad(map);
    }
  }, [onMapLoad]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapInitialized.current = false;
      }
    };
  }, []);

  // Set client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div style={style} className={className} />;
  }

  return (
    <div style={style} className={className}>
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%' }}
        ref={handleMapCreated}
        {...rest}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {children}
      </MapContainer>
    </div>
  );
};

export default MapView;
