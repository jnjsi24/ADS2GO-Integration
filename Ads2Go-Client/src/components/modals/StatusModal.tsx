import React, { useState, useEffect } from 'react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: string;
  lastIncident?: string;
}

const StatusModal: React.FC<StatusModalProps> = ({ isOpen, onClose }) => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'API Services',
      status: 'operational',
      uptime: '99.9%',
      lastIncident: 'No incidents in the past 30 days'
    },
    {
      name: 'Mobile App',
      status: 'operational',
      uptime: '99.8%',
      lastIncident: 'No incidents in the past 30 days'
    },
    {
      name: 'Web Platform',
      status: 'operational',
      uptime: '99.9%',
      lastIncident: 'No incidents in the past 30 days'
    },
    {
      name: 'Payment Processing',
      status: 'operational',
      uptime: '99.7%',
      lastIncident: 'No incidents in the past 30 days'
    },
    {
      name: 'Analytics Dashboard',
      status: 'operational',
      uptime: '99.6%',
      lastIncident: 'No incidents in the past 30 days'
    },
    {
      name: 'Email Services',
      status: 'operational',
      uptime: '99.5%',
      lastIncident: 'No incidents in the past 30 days'
    }
  ]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'outage':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'outage':
        return '❌';
      default:
        return '❓';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-lg p-8 w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] max-h-[80vh] overflow-y-auto transition-all duration-300 transform"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-colors duration-200 hover:scale-110 text-2xl"
          onClick={onClose}
        >
          ✕
        </button>
        
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-[#3674B5] mb-4">System Status</h2>
            <p className="text-gray-600">Real-time status of all Ads2Go services</p>
            <p className="text-sm text-gray-500 mt-2">
              Last updated: {currentTime.toLocaleString()}
            </p>
          </div>

          {/* Overall Status */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-center">
              <span className="text-4xl mr-4">✅</span>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-green-800">All Systems Operational</h3>
                <p className="text-green-600">All services are running normally</p>
              </div>
            </div>
          </div>

          {/* Services Status */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-[#3674B5]">Service Status</h3>
            <div className="space-y-3">
              {services.map((service, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getStatusIcon(service.status)}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{service.name}</h4>
                        <p className="text-sm text-gray-600">{service.lastIncident}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(service.status)}`}>
                        {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">Uptime: {service.uptime}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-800">99.8%</div>
              <div className="text-sm text-blue-600">Average Uptime</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-800">&lt;100ms</div>
              <div className="text-sm text-green-600">Response Time</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-800">24/7</div>
              <div className="text-sm text-purple-600">Monitoring</div>
            </div>
          </div>

          {/* Recent Incidents */}
          <div>
            <h3 className="text-xl font-semibold text-[#3674B5] mb-4">Recent Incidents</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-center text-gray-600">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-semibold">No recent incidents</p>
                <p className="text-sm">All systems have been running smoothly for the past 30 days</p>
              </div>
            </div>
          </div>

          {/* Maintenance Schedule */}
          <div>
            <h3 className="text-xl font-semibold text-[#3674B5] mb-4">Scheduled Maintenance</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🔧</span>
                <div>
                  <p className="font-semibold text-yellow-800">No scheduled maintenance</p>
                  <p className="text-sm text-yellow-600">All systems are running normally with no planned downtime</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[#3674B5] mb-4">Need Help?</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-gray-900 mb-2">Report an Issue</p>
                <p className="text-sm text-gray-600 mb-2">If you're experiencing problems, please contact our support team:</p>
                <p className="text-sm text-gray-700">support@ads2go.com</p>
                <p className="text-sm text-gray-700">+63 2 1234 5678</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-2">Status Updates</p>
                <p className="text-sm text-gray-600 mb-2">Follow us for real-time updates:</p>
                <div className="flex space-x-4">
                  <a href="#" className="text-sm text-blue-600 hover:underline">Twitter</a>
                  <a href="#" className="text-sm text-blue-600 hover:underline">Facebook</a>
                  <a href="#" className="text-sm text-blue-600 hover:underline">LinkedIn</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusModal;
