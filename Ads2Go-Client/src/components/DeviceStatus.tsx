import React from 'react';
import { useDeviceStatus } from '../contexts/DeviceStatusContext';
import { formatDistanceToNow } from 'date-fns';

interface DeviceStatusProps {
  className?: string;
}

const DeviceStatus: React.FC<DeviceStatusProps> = ({ className = '' }) => {
  const { devices, isConnected } = useDeviceStatus();

  const getStatusColor = (isOnline: boolean) => {
    return isOnline ? 'bg-green-500' : 'bg-gray-400';
  };

  const getLastSeenText = (lastSeen?: string) => {
    if (!lastSeen) return 'Never';
    try {
      const date = new Date(lastSeen);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  if (!isConnected) {
    return (
      <div className={`${className} p-4 bg-yellow-50 border border-yellow-200 rounded-lg`}>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
          <span className="text-sm text-yellow-800">Connecting to real-time updates...</span>
        </div>
      </div>
    );
  }

  const onlineDevices = devices.filter(d => d.isOnline);
  const totalDevices = devices.length;

  return (
    <div className={`${className} bg-white rounded-lg shadow overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Device Status</h3>
        <p className="text-sm text-gray-500">Real-time device connection status</p>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-1 gap-4">
          {/* Total Devices Card */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
            <div className="flex justify-center mb-2">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{totalDevices}</div>
            <div className="text-sm text-gray-600">Total Devices</div>
          </div>

          {/* Online Devices Card */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
            <div className="flex justify-center mb-2">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">{onlineDevices.length}</div>
            <div className="text-sm text-gray-600">Online Devices</div>
          </div>

          {/* Online Device List - Only show if there are online devices */}
          {onlineDevices.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Online Device IDs</h4>
              <div className="space-y-2">
                {onlineDevices.map((device) => (
                  <div key={device.deviceId} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                      <span className="text-sm font-medium text-gray-900">
                        {device.deviceId}
                      </span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">
                      Online
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceStatus;
