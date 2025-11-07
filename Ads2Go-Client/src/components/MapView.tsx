import React, { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, MapContainerProps } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import * as L from 'leaflet';
import 'leaflet-defaulticon-compatibility';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const [isContainerReady, setIsContainerReady] = React.useState(false);
  const [mapKey, setMapKey] = React.useState(0);
  const initialCenterRef = useRef<[number, number]>(center);
  const initialZoomRef = useRef<number>(zoom);

  // Set client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update initial values only when mapKey changes (map remounts)
  useEffect(() => {
    initialCenterRef.current = center;
    initialZoomRef.current = zoom;
  }, [mapKey, center, zoom]);

  // Check container readiness after mount - use a more aggressive approach
  useEffect(() => {
    if (!isClient) return;

    const checkReady = () => {
      const node = containerRef.current;
      if (!node) return false;
      
      // Multiple checks to ensure container is truly ready
      const rect = node.getBoundingClientRect();
      const hasHeight = rect.height > 0 && (node.offsetHeight > 0 || node.clientHeight > 0);
      const hasWidth = rect.width > 0 && (node.offsetWidth > 0 || node.clientWidth > 0);
      
      // Also check that element is actually in the DOM
      const isInDOM = node.isConnected && document.body.contains(node);
      
      return hasHeight && hasWidth && isInDOM;
    };

    // Use multiple animation frames to ensure DOM is fully painted
    let rafId: number;
    let frameCount = 0;
    const maxFrames = 5; // Wait for 5 frames to ensure stability
    
    const checkAfterPaint = () => {
      frameCount++;
      if (checkReady() && frameCount >= maxFrames) {
        setIsContainerReady(true);
        setMapKey(prev => prev + 1);
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
      } else if (frameCount < 30) { // Max 30 frames = ~500ms
        rafId = requestAnimationFrame(checkAfterPaint);
      }
    };
    
    // Start checking after a short delay
    const initialTimer = setTimeout(() => {
      rafId = requestAnimationFrame(checkAfterPaint);
    }, 200);
    
    // Fallback: check after multiple intervals
    let retryCount = 0;
    const maxRetries = 30;
    const intervalId = setInterval(() => {
      retryCount++;
      if (checkReady() && retryCount >= 3) {
        setIsContainerReady(true);
        setMapKey(prev => prev + 1);
        clearInterval(intervalId);
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
      } else if (retryCount >= maxRetries) {
        clearInterval(intervalId);
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        // Force ready after max retries if we have a container
        if (containerRef.current) {
          setIsContainerReady(true);
          setMapKey(prev => prev + 1);
        }
      }
    }, 100);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isClient]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        try {
          // Stop any ongoing animations before removing
          mapRef.current.stop();
          // Remove map properly
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.remove();
              mapRef.current = null;
            }
          }, 0);
        } catch (error) {
          console.warn('Map cleanup error:', error);
        }
      }
    };
  }, []);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    const map = (mapRef.current as any)?.contextValue?.map;
    if (map && onMapLoad) {
      onMapLoad(map);
    }
  }, [onMapLoad]);

  if (!isClient) {
    return <div ref={containerRef} style={style} className={className} />;
  }

  if (!isContainerReady) {
    return (
      <div 
        ref={containerRef} 
        style={{ ...style, minHeight: '100px', position: 'relative' }} 
        className={className}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading map...</div>
        </div>
      </div>
    );
  }

  // Only render MapContainer when container is confirmed ready AND has dimensions
  // Use a safer check that won't throw errors
  let canRenderMap = false;
  try {
    canRenderMap = isContainerReady && 
                   containerRef.current !== null && 
                   containerRef.current.isConnected &&
                   (() => {
                     try {
                       const rect = containerRef.current!.getBoundingClientRect();
                       return rect.height > 0 && rect.width > 0;
                     } catch {
                       return false;
                     }
                   })();
  } catch (error) {
    console.warn('Error checking container readiness:', error);
    canRenderMap = false;
  }

  if (!canRenderMap) {
    return (
      <div 
        ref={containerRef} 
        style={{ ...style, minHeight: '100px', position: 'relative' }} 
        className={className}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">
            {!isContainerReady ? 'Loading map...' : 'Initializing map container...'}
          </div>
        </div>
      </div>
    );
  }

  // Final safety check before rendering MapContainer
  if (!containerRef.current) {
    return (
      <div 
        ref={containerRef} 
        style={{ ...style, minHeight: '100px', position: 'relative' }} 
        className={className}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Preparing map...</div>
        </div>
      </div>
    );
  }

  try {
    return (
      <div ref={containerRef} id={`map-container-${mapKey}`} style={style} className={className}>
        <MapContainer 
          key={mapKey}
          center={initialCenterRef.current} 
          zoom={initialZoomRef.current} 
          style={{ height: '100%', width: '100%' }}
          whenReady={handleMapReady}
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
  } catch (error) {
    console.error('Error rendering MapContainer:', error);
    return (
      <div ref={containerRef} style={style} className={className}>
        <div className="flex items-center justify-center h-full bg-red-50">
          <div className="text-red-600">Map failed to load. Please refresh the page.</div>
        </div>
      </div>
    );
  }
};

export default MapView;
