import React from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Lock,
  Unlock,
  Eye,
  Settings,
  WifiOff,
  Monitor,
  RefreshCw,
  Check,
  Calendar
} from 'lucide-react';
import { ScreenData } from '../../../../types/screenTypes';
import AdProgressBar from '../../../../components/AdProgressBar';
import { motion, AnimatePresence } from 'framer-motion';

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
          'User-Agent': 'Ads2Go-AdminClient/1.0' // Required by Nominatim
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

interface DashboardProps {
  screens: ScreenData[];
  selectedScreens: string[];
  lastRefresh: Date;
  isRefreshing: boolean;
  isCurrentlyPlaying: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onScreenSelect: (screenId: string) => void;
  onScreenClick: (screen: ScreenData) => void;
  onScreenAction: (deviceId: string, action: string, value?: any) => void;
  onMaterialClick: (screen: ScreenData) => void;
  onBulkAction: (action: string) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusText: (status: string) => string;
  formatTime: (seconds: number | undefined) => string;
  devicePlayStates: Record<string, boolean>;
  deviceLockStates: Record<string, boolean>;
}

const Dashboard: React.FC<DashboardProps> = ({
  screens: initialScreens,
  selectedScreens,
  lastRefresh,
  isRefreshing,
  isCurrentlyPlaying,
  onSelectAll,
  onDeselectAll,
  onScreenSelect,
  onScreenClick,
  onScreenAction,
  onMaterialClick,
  onBulkAction,
  getStatusIcon,
  getStatusText,
  formatTime,
  devicePlayStates,
  deviceLockStates
}) => {
  // ✨ State to store screens with geocoded addresses
  const [screens, setScreens] = React.useState(initialScreens);
  // Ref to track if material button was clicked to prevent card click
  const materialButtonClickedRef = React.useRef<string | null>(null);
  
  // ✨ Geocode addresses when screens change or coordinates are present but address is missing
  React.useEffect(() => {
    const geocodeScreens = async () => {
      const screensWithAddresses = await Promise.all(
        initialScreens.map(async (screen) => {
          // If address is missing OR is just coordinates (starts with "Location:"), geocode on client
          const currentLocation = (screen as any).currentLocation;
          const needsGeocoding = currentLocation?.lat && currentLocation?.lng && 
            (!currentLocation?.address || currentLocation.address.startsWith('Location:'));
          
          if (needsGeocoding) {
            try {
              const address = await reverseGeocodeClient(currentLocation.lat, currentLocation.lng);
              return {
                ...screen,
                currentLocation: {
                  ...currentLocation,
                  address: address
                }
              };
            } catch (error) {
              console.warn(`Failed to geocode ${currentLocation.lat}, ${currentLocation.lng}:`, error);
              return screen; // Return original if geocoding fails
            }
          }
          return screen;
        })
      );
      
      setScreens(screensWithAddresses);
    };
    
    geocodeScreens();
  }, [initialScreens]);
  
  // Close all dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdowns = document.querySelectorAll('.dropdown-menu');
      dropdowns.forEach(dropdown => {
        if (!dropdown.contains(event.target as Node)) {
          dropdown.classList.add('opacity-0', 'invisible');
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div className="space-y-6">
      {/* Screen Status Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Live Screen Status</h3>
            <p className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onSelectAll}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
            >
              Select All
            </button>
            <button
              onClick={onDeselectAll}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Bulk Operations */}
        {selectedScreens.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h4 className="font-medium mb-3">Bulk Operations ({selectedScreens.length} selected)</h4>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => onBulkAction('play')}
                className="px-3 py-1 bg-green-100 text-green-600 rounded-md text-sm hover:bg-green-200"
              >
                <Play className="w-4 h-4 inline mr-1" />
                Play Selected
              </button>
              <button 
                onClick={() => onBulkAction('pause')}
                className="px-3 py-1 bg-yellow-100 text-yellow-600 rounded-md text-sm hover:bg-yellow-200"
              >
                <Pause className="w-4 h-4 inline mr-1" />
                Pause Selected
              </button>
              <button 
                onClick={() => onBulkAction('lock')}
                className="px-3 py-1 bg-orange-100 text-orange-600 rounded-md text-sm hover:bg-orange-200"
              >
                <Lock className="w-4 h-4 inline mr-1" />
                Lock Selected
              </button>
              <button 
                onClick={() => onBulkAction('unlock')}
                className="px-3 py-1 bg-green-100 text-green-600 rounded-md text-sm hover:bg-green-200"
              >
                <Unlock className="w-4 h-4 inline mr-1" />
                Unlock Selected
              </button>
              <button 
                onClick={() => onBulkAction('sync')}
                className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200"
              >
                <Monitor className="w-4 h-4 inline mr-1" />
                Sync Selected
              </button>
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          {screens.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <WifiOff className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No devices found</h3>
              <p className="mt-1 text-sm text-gray-500">No screens are currently available.</p>
              <p className="mt-1 text-xs text-gray-400">Check the Screen Tracking page for real-time device status.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-2">
              {screens.map((screen) => (
                <div
                  key={screen.deviceId}
                  onClick={() => {
                    // Don't trigger if material button was clicked
                    if (materialButtonClickedRef.current === screen.deviceId) {
                      materialButtonClickedRef.current = null;
                      return;
                    }
                    onScreenClick(screen);
                  }}
                  className="bg-white mb-3 rounded-lg shadow-md hover:bg-gray-50 transition-colors border border-gray-100 p-4">
                  {/* Top Row: Checkbox, Screen ID, and Actions */}
                  <div className="flex flex-wrap justify-between items-center pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <motion.div
                        onClick={(e) => {
                          e.stopPropagation();
                          onScreenSelect(screen.deviceId);
                        }}
                        className="w-4 h-4 border-2 border-gray-400 rounded flex items-center justify-center cursor-pointer"
                        initial={false}
                        animate={{
                          scale: selectedScreens.includes(screen.deviceId) ? 1.05 : 1,
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <AnimatePresence>
                          {selectedScreens.includes(screen.deviceId) && (
                            <motion.div
                              key="check"
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check className="w-3 h-3 text-black" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          // Set ref to prevent card click
                          materialButtonClickedRef.current = screen.deviceId;
                          onMaterialClick(screen);
                          // Clear ref after a short delay
                          setTimeout(() => {
                            materialButtonClickedRef.current = null;
                          }, 100);
                        }}
                        className="text-black font-medium text-sm hover:text-blue-600 hover:underline cursor-pointer"
                        title="Click to view device details"
                      >
                        {screen.displayId || `${screen.materialId}-SLOT-${screen.slotNumber}`}
                      </button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                        {/* Individual Device Controls */}
                        <div className="relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Toggle dropdown by adding/removing a class
                              const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                              if (dropdown) {
                                dropdown.classList.toggle('opacity-0');
                                dropdown.classList.toggle('invisible');
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Device Controls"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          
                          {/* Dropdown Menu */}
                          <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                            <div className="py-1">
                              {(() => {
                                // Use master control state instead of individual device state
                                // This ensures individual controls show the opposite of master control
                                const isOnline = screen.isOnline;
                                const hasCurrentAd = screen.screenMetrics?.currentAd;
                                
                                // Debug logging (only in verbose mode)
                                if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_DASHBOARD === 'true') {
                                  console.log(`🎬 [Dashboard] Screen ${screen.deviceId} state:`, {
                                    isOnline,
                                    hasCurrentAd: !!hasCurrentAd,
                                    masterControlState: isCurrentlyPlaying,
                                    devicePlayState: devicePlayStates[screen.deviceId]
                                  });
                                }
                                
                                return (
                                  <>
                                    <button
                                      onClick={() => onScreenAction(screen.deviceId, 'play')}
                                      disabled={!isOnline || isCurrentlyPlaying}
                                      className={`flex items-center w-full px-4 py-2 text-sm ${
                                        !isOnline || isCurrentlyPlaying
                                          ? 'text-gray-400 cursor-not-allowed'
                                          : 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                                      }`}
                                      title={!isOnline ? 'Device offline' : isCurrentlyPlaying ? 'Already playing' : 'Play ads'}
                                    >
                                      <Play className="w-4 h-4 mr-2" />
                                      Play
                                    </button>
                                    <button
                                      onClick={() => onScreenAction(screen.deviceId, 'pause')}
                                      disabled={!isOnline || !isCurrentlyPlaying}
                                      className={`flex items-center w-full px-4 py-2 text-sm ${
                                        !isOnline || !isCurrentlyPlaying
                                          ? 'text-gray-400 cursor-not-allowed'
                                          : 'text-gray-700 hover:bg-yellow-50 hover:text-yellow-600'
                                      }`}
                                      title={!isOnline ? 'Device offline' : !isCurrentlyPlaying ? 'Not currently playing' : 'Pause ads'}
                                    >
                                      <Pause className="w-4 h-4 mr-2" />
                                      Pause
                                    </button>
                                    {(() => {
                                      const isLocked = deviceLockStates[screen.deviceId] ?? true; // Default to locked since adsplayer starts locked
                                      return (
                                        <button
                                          onClick={() => onScreenAction(screen.deviceId, isLocked ? 'unlock' : 'lock')}
                                          disabled={!isOnline}
                                          className={`flex items-center w-full px-4 py-2 text-sm ${
                                            !isOnline
                                              ? 'text-gray-400 cursor-not-allowed'
                                              : isLocked
                                              ? 'text-gray-700 hover:bg-green-50 hover:text-green-600'
                                              : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
                                          }`}
                                          title={!isOnline ? 'Device offline' : isLocked ? 'Unlock device' : 'Lock device'}
                                        >
                                          {isLocked ? (
                                            <Unlock className="w-4 h-4 mr-2" />
                                          ) : (
                                            <Lock className="w-4 h-4 mr-2" />
                                          )}
                                          {isLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                      );
                                    })()}
                                  </>
                                );
                              })()}
                              <div className="border-t border-gray-100"></div>
                              <button
                                onClick={() => onScreenClick(screen)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                  </div>

                  {/* Middle Section: Status, Current Ad, Progress */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Status */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Status</h4>
                      <div className="flex items-center space-x-2">
                        
                        <div className="flex flex-col">
                          {screen.slot1Status && screen.slot2Status ? (
                            // Show individual slot statuses for consolidated view
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${screen.slot1Status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`text-sm font-medium ${screen.slot1Status === 'ONLINE' ? 'text-green-600' : 'text-red-600'}`}>
                                  Slot 1: {screen.slot1Status}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${screen.slot2Status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`text-sm font-medium ${screen.slot2Status === 'ONLINE' ? 'text-green-600' : 'text-red-600'}`}>
                                  Slot 2: {screen.slot2Status}
                                </span>
                              </div>
                            </div>
                          ) : (
                            // Show single status for non-consolidated view
                            <span className={`text-sm font-medium ${
                              screen.isOnline ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {screen.statusText || getStatusText(screen.isOnline ? 'online' : 'offline')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Current Ad */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Current Ad</h4>
                      {screen.screenMetrics?.currentAd && screen.screenMetrics.currentAd.adTitle ? (
                        <div>
                          <div className="font-medium text-sm">{screen.screenMetrics.currentAd.adTitle}</div>
                          <div className="text-xs text-gray-500">
                            Duration: {screen.screenMetrics.currentAd.adDuration ? `${screen.screenMetrics.currentAd.adDuration}s` : 'Unknown'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No ads playing</span>
                      )}
                    </div>

                    {/* Progress */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Progress</h4>
                      {screen.screenMetrics?.currentAd && screen.screenMetrics.currentAd.adDuration ? (
                        <AdProgressBar 
                          adDuration={screen.screenMetrics.currentAd.adDuration}
                          isPlaying={screen.isOnline}
                          className="w-full"
                          startTime={screen.screenMetrics.currentAd.startTime}
                          realTimeData={screen.screenMetrics.currentAd.currentTime !== undefined ? {
                            currentTime: screen.screenMetrics.currentAd.currentTime,
                            progress: screen.screenMetrics.currentAd.progress || 0,
                            state: (screen.screenMetrics.currentAd.state || 'playing') as "ended" | "playing" | "paused" | "buffering" | "loading"
                          } : undefined}
                        />
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Location */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    <h4 className="text-sm text-gray-600">Location:</h4>
                    <p className="text-sm font-semibold text-gray-700">
                      {screen.currentLocation?.address || 
                       (screen.currentLocation?.lat && screen.currentLocation?.lng ? 
                        `Location: ${screen.currentLocation.lat.toFixed(6)}, ${screen.currentLocation.lng.toFixed(6)}` : 
                        'Location not available')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
