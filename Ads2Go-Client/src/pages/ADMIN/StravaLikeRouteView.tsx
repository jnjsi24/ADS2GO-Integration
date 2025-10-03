import React, { useState } from 'react';
import EnhancedRouteMap from '../../components/EnhancedRouteMap';

const StravaLikeRouteView: React.FC = () => {
  const [deviceId, setDeviceId] = useState('TABLET-123');
  const [showSpeedColors, setShowSpeedColors] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🏃‍♂️ Strava-like Route Tracking
        </h1>
        <p className="text-gray-600">
          View device routes with Strava-style visualization including speed colors, waypoints, and detailed metrics.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter device ID"
            />
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showSpeedColors}
                onChange={(e) => setShowSpeedColors(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Speed Colors</span>
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showWaypoints}
                onChange={(e) => setShowWaypoints(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Waypoints</span>
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showMetrics}
                onChange={(e) => setShowMetrics(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Metrics Panel</span>
            </label>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="h-96">
          <EnhancedRouteMap
            deviceId={deviceId}
            showSpeedColors={showSpeedColors}
            showWaypoints={showWaypoints}
            showMetrics={showMetrics}
            onRouteLoad={(data) => {
              console.log('Route loaded:', data);
            }}
          />
        </div>
      </div>

      {/* Features Description */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">🎨 Speed Colors</h3>
          <p className="text-sm text-blue-700">
            Route segments are colored based on speed: red (slow), orange (medium), yellow (fast), green (very fast).
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">📍 Waypoints</h3>
          <p className="text-sm text-green-700">
            Show intermediate points along the route with speed and time information for detailed analysis.
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-purple-900 mb-2">📊 Metrics Panel</h3>
          <p className="text-sm text-purple-700">
            Real-time stats including distance, duration, average speed, ad plays, and QR scans.
          </p>
        </div>
      </div>

      {/* Speed Legend */}
      {showSpeedColors && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Speed Color Legend</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-700">Stopped/Slow (&lt;5 km/h)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-gray-700">Slow (5-15 km/h)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-gray-700">Medium (15-30 km/h)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">Fast (&gt;30 km/h)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StravaLikeRouteView;
