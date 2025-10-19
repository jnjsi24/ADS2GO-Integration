import React from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  Eye,
  WifiOff,
  SkipForward, Check
} from 'lucide-react';
import { ScreenData } from '../../../../types/screenTypes';
import AdProgressBar from '../../../../components/AdProgressBar';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  screens: ScreenData[];
  selectedScreens: string[];
  lastRefresh: Date;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onScreenSelect: (screenId: string) => void;
  onScreenClick: (screen: ScreenData) => void;
  onMaterialClick: (screen: ScreenData) => void;
  onBulkAction: (action: string) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusText: (status: string) => string;
  formatTime: (seconds: number | undefined) => string;
}

const Dashboard: React.FC<DashboardProps> = ({
  screens,
  selectedScreens,
  lastRefresh,
  isRefreshing,
  onRefresh,
  onSelectAll,
  onDeselectAll,
  onScreenSelect,
  onScreenClick,
  onMaterialClick,
  onBulkAction,
  getStatusIcon,
  getStatusText,
  formatTime
}) => {
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
            {selectedScreens.length === screens.length ? (
              <button
                onClick={onDeselectAll}
                className="px-4 py-2 border text-black/80 bg-gray-200 rounded-md shadow-md hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
              >
                Deselect All
              </button>
            ) : (
              <button
                onClick={onSelectAll}
                className="px-4 py-2 text-black rounded-md shadow-md hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
              >
                Select All
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-[#3674B5] text-white rounded-md shadow-lg hover:bg-[#3674B5]/80 disabled:opacity-50 flex items-center gap-2"
            >
              Refresh
            </button>
          </div>
        </div>
        
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
                  onClick={() => onScreenClick(screen)}
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

                      <button className="text-black font-medium text-sm">
                        {screen.displayId || `${screen.materialId}-SLOT-${screen.slotNumber}`}
                      </button>
                    </div>
                    {selectedScreens.includes(screen.deviceId) ? (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                        <button 
                          onClick={() => onBulkAction('play')}
                          className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-600 rounded-md text-sm hover:bg-green-200"
                        >
                          <Play className="w-4 h-4" />
                          <span>Play</span>
                        </button>

                        <button 
                          onClick={() => onBulkAction('pause')}
                          className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-600 rounded-md text-sm hover:bg-yellow-200"
                        >
                          <Pause className="w-4 h-4" />
                          <span>Pause</span>
                        </button>

                        <button 
                          onClick={() => onBulkAction('stop')}
                          className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-600 rounded-md text-sm hover:bg-red-200"
                        >
                          <Square className="w-4 h-4" />
                          <span>Stop</span>
                        </button>

                        <button 
                          onClick={() => onBulkAction('sync')}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>Sync</span>
                        </button>
                      </div>

                    ) : (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                        {/* Play */}
                        <button className="group flex items-center bg-green-100 text-green-700 rounded-md overflow-hidden h-8 w-7 hover:w-14 transition-[width] duration-300 border border-green-200">
                          <Play className="flex-shrink-0 ml-1 transition-all duration-300" size={16} />
                          <span className="opacity-0 group-hover:opacity-100 text-xs ml-1 font-medium whitespace-nowrap transition-all duration-300">
                            Play
                          </span>
                        </button>

                        {/* Pause */}
                        <button className="group flex items-center bg-yellow-100 text-yellow-700 rounded-md overflow-hidden h-8 w-8 hover:w-16 transition-[width] duration-300 border border-yellow-200">
                          <Pause className="flex-shrink-0 ml-1.5 transition-all duration-300" size={16} />
                          <span className="opacity-0 group-hover:opacity-100 text-xs font-medium ml-1 whitespace-nowrap transition-all duration-300">
                            Pause
                          </span>
                        </button>

                        {/* Stop */}
                        <button className="group flex items-center bg-red-100 text-red-700 rounded-md overflow-hidden h-8 w-8 hover:w-14 transition-[width] duration-300 border border-red-200">
                          <Square className="flex-shrink-0 ml-1.5 transition-all duration-300" size={16} />
                          <span className="opacity-0 group-hover:opacity-100 text-xs font-medium ml-1 whitespace-nowrap transition-all duration-300">
                            Stop
                          </span>
                        </button>

                        {/* Next */}
                        <button className="group flex items-center bg-blue-100 text-blue-700 rounded-md overflow-hidden h-8 w-7 hover:w-14 transition-[width] duration-300 border border-blue-200">
                          <SkipForward className="flex-shrink-0 ml-1 transition-all duration-300" size={16} />
                          <span className="opacity-0 group-hover:opacity-100 text-xs font-medium ml-1 whitespace-nowrap transition-all duration-300">
                            Next
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Middle Section: Status, Current Ad, Progress */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Status */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Status</h4>
                      {screen.slot1Status && screen.slot2Status ? (
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Slot 1 */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                screen.slot1Status === "ONLINE" ? "bg-green-500" : "bg-red-500"
                              }`}
                            ></div>
                            <span
                              className={`text-sm font-medium ${
                                screen.slot1Status === "ONLINE" ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              Slot 1: {screen.slot1Status}
                            </span>
                          </div>

                          {/* Slot 2 */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                screen.slot2Status === "ONLINE" ? "bg-green-500" : "bg-red-500"
                              }`}
                            ></div>
                            <span
                              className={`text-sm font-medium ${
                                screen.slot2Status === "ONLINE" ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              Slot 2: {screen.slot2Status}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span
                          className={`text-sm font-medium ${
                            screen.isOnline ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {screen.statusText || getStatusText(screen.isOnline ? "online" : "offline")}
                        </span>
                      )}
                    </div>
                    {/* Current Ad */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Current Ad</h4>
                      {screen.screenMetrics?.currentAd?.adTitle ? (
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {screen.screenMetrics.currentAd.adTitle}
                          </p>
                          <p className="text-xs text-gray-500">
                            Duration:{" "}
                            {screen.screenMetrics.currentAd.adDuration
                              ? `${screen.screenMetrics.currentAd.adDuration}s`
                              : "Unknown"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">No ads playing</p>
                      )}
                    </div>

                    {/* Progress */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Progress</h4>
                      {screen.screenMetrics?.currentAd?.adDuration ? (
                        <AdProgressBar
                          adDuration={screen.screenMetrics.currentAd.adDuration}
                          isPlaying={screen.isOnline}
                          className="w-full"
                          startTime={screen.screenMetrics.currentAd.startTime}
                          realTimeData={
                            screen.screenMetrics.currentAd.currentTime !== undefined
                              ? {
                                  currentTime: screen.screenMetrics.currentAd.currentTime,
                                  progress: screen.screenMetrics.currentAd.progress || 0,
                                  state: screen.screenMetrics.currentAd.state || "playing",
                                }
                              : undefined
                          }
                        />
                      ) : (
                        <p className="text-gray-400 text-sm">-</p>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Location */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                    <h4 className="text-sm text-gray-600">Location:</h4>
                    <p className="text-sm font-semibold text-gray-700">
                      {screen.currentLocation?.address ||
                        (screen.currentLocation?.lat && screen.currentLocation?.lng
                          ? `Lat: ${screen.currentLocation.lat.toFixed(6)}, Lng: ${screen.currentLocation.lng.toFixed(6)}`
                          : "Location not available")}
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
