import React from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Settings
} from 'lucide-react';
import { ScreenData } from '../../../services/adsPanelGraphQLService';
import AdProgressBar from '../../../../components/AdProgressBar';

interface ScreenControlProps {
  screens: ScreenData[];
  onScreenAction: (deviceId: string, action: string, value?: any) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusText: (status: string) => string;
  formatTime: (seconds: number | undefined) => string;
}

const ScreenControl: React.FC<ScreenControlProps> = ({
  screens,
  onScreenAction,
  getStatusIcon,
  getStatusText,
  formatTime
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Individual Screen Controls</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {screens.map((screen) => (
          <div key={screen.deviceId} className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">{screen.deviceId}</h4>
              <div className="flex items-center space-x-2">
                {getStatusIcon(screen.isOnline ? 'online' : 'offline')}
                <span className="text-sm">{getStatusText(screen.isOnline ? 'online' : 'offline')}</span>
              </div>
            </div>
            
            {screen.screenMetrics?.currentAd && screen.screenMetrics.currentAd.adTitle ? (
              <div className="mb-3">
                <div className="text-sm font-medium">{screen.screenMetrics.currentAd.adTitle}</div>
                <div className="text-xs text-gray-500">
                  Duration: {screen.screenMetrics.currentAd.adDuration ? `${screen.screenMetrics.currentAd.adDuration}s` : 'Unknown'}
                </div>
                <div className="mt-1">
                  <AdProgressBar 
                    adDuration={screen.screenMetrics.currentAd.adDuration}
                    isPlaying={screen.isOnline}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              <div className="mb-3 text-gray-400 text-sm">
                No ads currently playing
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Brightness</span>
                <span>{screen.screenMetrics?.brightness || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ width: `${screen.screenMetrics?.brightness || 0}%` }}
                ></div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span>Volume</span>
                <span>{screen.screenMetrics?.volume || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${screen.screenMetrics?.volume || 0}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex space-x-1">
                <button 
                  onClick={() => onScreenAction(screen.deviceId, 'play')}
                  className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200"
                  title="Play"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onScreenAction(screen.deviceId, 'pause')}
                  className="p-2 bg-yellow-100 text-yellow-600 rounded hover:bg-yellow-200"
                  title="Pause"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onScreenAction(screen.deviceId, 'stop')}
                  className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={() => onScreenAction(screen.deviceId, 'settings')}
                className="p-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScreenControl;
