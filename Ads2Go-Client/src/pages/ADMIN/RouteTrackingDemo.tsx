import React, { useState } from 'react';
import EnhancedRouteMap from '../../components/EnhancedRouteMap';

const RouteTrackingDemo: React.FC = () => {
  const [deviceId, setDeviceId] = useState('TABLET-samsung-SM-A207F-samsung-a20sxx-a20s-11-RP1A-200720-012-A207FXXU3CVH4-user-release-keys-11-mddtig-1759407031647');
  const [showSpeedColors, setShowSpeedColors] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🏃‍♂️ Strava-like Route Tracking Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Experience the enhanced route visualization with speed-colored segments, waypoints, 
            and detailed metrics - just like Strava! This replaces the basic red line with 
            a comprehensive route analysis system.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Controls</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Device ID
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter device ID"
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showSpeedColors}
                  onChange={(e) => setShowSpeedColors(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">Speed Colors</span>
              </label>
              <p className="text-xs text-gray-500 ml-8">
                Color route segments based on speed
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showWaypoints}
                  onChange={(e) => setShowWaypoints(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">Waypoints</span>
              </label>
              <p className="text-xs text-gray-500 ml-8">
                Show intermediate points along route
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showMetrics}
                  onChange={(e) => setShowMetrics(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">Metrics Panel</span>
              </label>
              <p className="text-xs text-gray-500 ml-8">
                Display route statistics overlay
              </p>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="h-[600px]">
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

        {/* Features Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white text-xl">🎨</span>
              </div>
              <h3 className="text-lg font-semibold text-blue-900">Speed Colors</h3>
            </div>
            <p className="text-blue-700 text-sm mb-3">
              Route segments are colored based on speed, just like Strava's pace visualization.
            </p>
            <div className="space-y-1 text-xs text-blue-600">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span>Red: Stopped/Slow (&lt;5 km/h)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                <span>Orange: Slow (5-15 km/h)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                <span>Yellow: Medium (15-30 km/h)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span>Green: Fast (&gt;30 km/h)</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white text-xl">📍</span>
              </div>
              <h3 className="text-lg font-semibold text-green-900">Waypoints</h3>
            </div>
            <p className="text-green-700 text-sm mb-3">
              Interactive waypoints show intermediate points along the route with detailed information.
            </p>
            <ul className="text-xs text-green-600 space-y-1">
              <li>• Speed at each waypoint</li>
              <li>• Timestamp information</li>
              <li>• Address data (when available)</li>
              <li>• Click for detailed popup</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white text-xl">📊</span>
              </div>
              <h3 className="text-lg font-semibold text-purple-900">Metrics Panel</h3>
            </div>
            <p className="text-purple-700 text-sm mb-3">
              Real-time statistics overlay with comprehensive route analysis.
            </p>
            <ul className="text-xs text-purple-600 space-y-1">
              <li>• Total distance traveled</li>
              <li>• Duration and average speed</li>
              <li>• Ad plays and QR scans</li>
              <li>• Total GPS points recorded</li>
            </ul>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Before vs After</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-red-600 mb-3">❌ Before (Basic)</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Single red line for entire route</li>
                <li>• No speed information</li>
                <li>• Basic start/end markers only</li>
                <li>• Limited route analysis</li>
                <li>• No interactive waypoints</li>
                <li>• Basic metrics panel</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-3">✅ After (Strava-like)</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Speed-colored route segments</li>
                <li>• Visual speed analysis</li>
                <li>• Interactive waypoints with details</li>
                <li>• Comprehensive route metrics</li>
                <li>• Real-time statistics overlay</li>
                <li>• Professional visualization</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">How to Use</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">In the Dashboard:</h3>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Go to "Devices Tracking" in the sidebar</li>
                <li>2. Switch to "Historical Routes" tab</li>
                <li>3. Select a device from the screens list</li>
                <li>4. Click "Load Route" button</li>
                <li>5. Toggle the enhanced controls (Speed Colors, Waypoints, Metrics)</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">Features:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Speed colors show movement patterns</li>
                <li>• Waypoints reveal detailed stops</li>
                <li>• Metrics provide comprehensive analysis</li>
                <li>• Auto-fit map shows complete route</li>
                <li>• Interactive popups with detailed info</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteTrackingDemo;
