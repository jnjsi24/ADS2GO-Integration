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

  return (
    <div className={`${className} bg-white rounded-lg shadow overflow-hidden`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Device Status</h3>
        <p className="text-sm text-gray-500">Real-time device connection status</p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {devices.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No devices connected
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.deviceId} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(device.isOnline)} mr-2`}></div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {device.materialId || device.deviceId}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {device.deviceId}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <p className={`text-xs ${device.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                    {device.isOnline ? 'Online' : `Last seen ${getLastSeenText(device.lastSeen)}`}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-right">
        <p className="text-xs text-gray-500">
          {devices.filter(d => d.isOnline).length} of {devices.length} devices online
        </p>
      </div>
    </div>
  );
};

export default DeviceStatus;
