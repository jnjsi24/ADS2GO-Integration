import React from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Info 
} from 'lucide-react';

interface Alert {
  id: number;
  type: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
}

interface AlertsProps {
  alerts?: Alert[];
  onResolveAlert?: (alertId: number) => void;
  onViewAlert?: (alertId: number) => void;
}

const Alerts: React.FC<AlertsProps> = ({ 
  alerts = [], 
  onResolveAlert, 
  onViewAlert 
}) => {
  // Mock data for demonstration
  const mockAlerts: Alert[] = [
    { id: 1, type: 'critical', message: 'Device ABC123 offline for 2+ hours', timestamp: '2 minutes ago' },
    { id: 2, type: 'high', message: 'Low battery on device XYZ789', timestamp: '15 minutes ago' },
    { id: 3, type: 'medium', message: 'Ad playback error on device DEF456', timestamp: '1 hour ago' },
    { id: 4, type: 'low', message: 'Scheduled maintenance completed', timestamp: '2 hours ago' }
  ];

  const displayAlerts = alerts.length > 0 ? alerts : mockAlerts;

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high': return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getAlertCounts = () => {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    displayAlerts.forEach(alert => {
      counts[alert.type]++;
    });

    return counts;
  };

  const alertCounts = getAlertCounts();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Alert Center</h3>
      
      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Critical</p>
              <p className="text-2xl font-bold text-red-700">{alertCounts.critical}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">High</p>
              <p className="text-2xl font-bold text-orange-700">{alertCounts.high}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Medium</p>
              <p className="text-2xl font-bold text-yellow-700">{alertCounts.medium}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Low</p>
              <p className="text-2xl font-bold text-green-700">{alertCounts.low}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-3">Active Alerts</h4>
        <div className="space-y-3">
          {displayAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-2" />
              <p>No active alerts</p>
              <p className="text-sm">All systems are running smoothly</p>
            </div>
          ) : (
            displayAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getAlertIcon(alert.type)}
                  <div>
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-sm text-gray-500">{alert.timestamp}</div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => onViewAlert?.(alert.id)}
                    className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => onResolveAlert?.(alert.id)}
                    className="px-3 py-1 bg-green-100 text-green-600 rounded text-sm hover:bg-green-200"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
