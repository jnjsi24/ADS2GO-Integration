import React from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  Eye,
  Settings,
  WifiOff
} from 'lucide-react';
import { ScreenData } from '../../../../services/adsPanelGraphQLService';

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
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="px-3 py-1 text-sm bg-green-100 text-green-600 rounded-md hover:bg-green-200 disabled:opacity-50"
            >
              Refresh
            </button>
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
        
        <div className="overflow-x-auto">
          {screens.filter(screen => screen.isOnline).length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <WifiOff className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No active devices</h3>
              <p className="mt-1 text-sm text-gray-500">No screens are currently online and connected via WebSocket.</p>
              <p className="mt-1 text-xs text-gray-400">Check the Screen Tracking page for real-time device status.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4">
                    <input type="checkbox" className="rounded" />
                  </th>
                  <th className="text-left py-3 px-4">Screen ID</th>
                  <th className="text-left py-3 px-4">Slot</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Current Ad</th>
                  <th className="text-left py-3 px-4">Progress</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {screens.filter(screen => screen.isOnline).map((screen) => (
                <tr key={screen.deviceId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedScreens.includes(screen.deviceId)}
                      onChange={() => onScreenSelect(screen.deviceId)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onMaterialClick(screen)}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                      title="Click to view device details"
                    >
                      {screen.displayId || `${screen.materialId}-SLOT-${screen.slotNumber}`}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{screen.slotNumber}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(screen.isOnline ? 'online' : 'offline')}
                      <span className="text-sm">{getStatusText(screen.isOnline ? 'online' : 'offline')}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
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
                  </td>
                  <td className="py-3 px-4">
                    {screen.screenMetrics?.currentAd && screen.screenMetrics.currentAd.adDuration ? (
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{formatTime(0)}</span>
                          <span>{formatTime(screen.screenMetrics.currentAd.adDuration)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: '0%' }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          Ready to play
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {typeof screen.currentLocation === 'string' 
                      ? screen.currentLocation 
                      : (screen.currentLocation as any)?.address || 'Unknown Location'
                    }
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onScreenClick(screen)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Bulk Operations */}
      {selectedScreens.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
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
              onClick={() => onBulkAction('stop')}
              className="px-3 py-1 bg-red-100 text-red-600 rounded-md text-sm hover:bg-red-200"
            >
              <Square className="w-4 h-4 inline mr-1" />
              Stop Selected
            </button>
            <button 
              onClick={() => onBulkAction('sync')}
              className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md text-sm hover:bg-blue-200"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              Sync Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
