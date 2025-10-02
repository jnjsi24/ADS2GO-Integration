import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { 
  Clock, 
  Car, 
  Calendar, 
  Play, 
  Pause, 
  Wifi, 
  WifiOff, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, addHours, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Mock data structure - replace with actual GraphQL query
interface VehicleAirtime {
  vehicleId: string;
  materialId: string;
  vehicleName: string;
  driverName: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  currentLocation: string;
  hourlyAvailability: {
    hour: number;
    timeSlot: string;
    isAvailable: boolean;
    scheduledAds: number;
    availableSlots: number;
    totalSlots: number;
    currentAd?: {
      adId: string;
      adTitle: string;
      remainingTime: number;
    };
  }[];
  totalAvailableHours: number;
  totalScheduledHours: number;
  utilizationRate: number;
}

interface AirtimeAvailabilityProps {
  selectedDate?: Date;
  selectedVehicle?: string;
}

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'online', label: 'Online Only' },
  { value: 'offline', label: 'Offline Only' },
];

const timeOptions = [
  { value: 'all', label: 'All Time Slots' },
  { value: 'available', label: 'Available Only' },
  { value: 'busy', label: 'Busy Only' },
];

const AirtimeAvailability: React.FC<AirtimeAvailabilityProps> = ({ 
  selectedDate = new Date(),
  selectedVehicle 
}) => {
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<'all' | 'available' | 'busy'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  // Mock data - replace with actual GraphQL query
  const mockVehicles: VehicleAirtime[] = [
    {
      vehicleId: 'VH001',
      materialId: 'MAT001',
      vehicleName: 'Tricycle #001',
      driverName: 'Juan Dela Cruz',
      status: 'ONLINE',
      currentLocation: 'Makati City',
      totalAvailableHours: 8,
      totalScheduledHours: 6,
      utilizationRate: 75,
      hourlyAvailability: [
        { hour: 6, timeSlot: '06:00-07:00', isAvailable: false, scheduledAds: 1, availableSlots: 0, totalSlots: 2, currentAd: { adId: 'AD001', adTitle: 'McDonald\'s Promo', remainingTime: 45 } },
        { hour: 7, timeSlot: '07:00-08:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 8, timeSlot: '08:00-09:00', isAvailable: false, scheduledAds: 2, availableSlots: 0, totalSlots: 2 },
        { hour: 9, timeSlot: '09:00-10:00', isAvailable: true, scheduledAds: 0, availableSlots: 1, totalSlots: 2 },
        { hour: 10, timeSlot: '10:00-11:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 11, timeSlot: '11:00-12:00', isAvailable: false, scheduledAds: 1, availableSlots: 0, totalSlots: 2 },
        { hour: 12, timeSlot: '12:00-13:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 13, timeSlot: '13:00-14:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 14, timeSlot: '14:00-15:00', isAvailable: false, scheduledAds: 2, availableSlots: 0, totalSlots: 2 },
        { hour: 15, timeSlot: '15:00-16:00', isAvailable: true, scheduledAds: 0, availableSlots: 1, totalSlots: 2 },
        { hour: 16, timeSlot: '16:00-17:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 17, timeSlot: '17:00-18:00', isAvailable: false, scheduledAds: 1, availableSlots: 0, totalSlots: 2 },
        { hour: 18, timeSlot: '18:00-19:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 19, timeSlot: '19:00-20:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 20, timeSlot: '20:00-21:00', isAvailable: false, scheduledAds: 1, availableSlots: 0, totalSlots: 2 },
        { hour: 21, timeSlot: '21:00-22:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
      ]
    },
    {
      vehicleId: 'VH002',
      materialId: 'MAT002',
      vehicleName: 'Tricycle #002',
      driverName: 'Maria Santos',
      status: 'ONLINE',
      currentLocation: 'Quezon City',
      totalAvailableHours: 8,
      totalScheduledHours: 4,
      utilizationRate: 50,
      hourlyAvailability: [
        { hour: 6, timeSlot: '06:00-07:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 7, timeSlot: '07:00-08:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 8, timeSlot: '08:00-09:00', isAvailable: false, scheduledAds: 1, availableSlots: 0, totalSlots: 2 },
        { hour: 9, timeSlot: '09:00-10:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 10, timeSlot: '10:00-11:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 11, timeSlot: '11:00-12:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 12, timeSlot: '12:00-13:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 13, timeSlot: '13:00-14:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 14, timeSlot: '14:00-15:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 15, timeSlot: '15:00-16:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 16, timeSlot: '16:00-17:00', isAvailable: false, scheduledAds: 2, availableSlots: 0, totalSlots: 2 },
        { hour: 17, timeSlot: '17:00-18:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 18, timeSlot: '18:00-19:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 19, timeSlot: '19:00-20:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 20, timeSlot: '20:00-21:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
        { hour: 21, timeSlot: '21:00-22:00', isAvailable: true, scheduledAds: 0, availableSlots: 2, totalSlots: 2 },
      ]
    },
    {
      vehicleId: 'VH003',
      materialId: 'MAT003',
      vehicleName: 'Tricycle #003',
      driverName: 'Pedro Garcia',
      status: 'OFFLINE',
      currentLocation: 'Manila',
      totalAvailableHours: 0,
      totalScheduledHours: 0,
      utilizationRate: 0,
      hourlyAvailability: Array.from({ length: 16 }, (_, i) => ({
        hour: i + 6,
        timeSlot: `${String(i + 6).padStart(2, '0')}:00-${String(i + 7).padStart(2, '0')}:00`,
        isAvailable: false,
        scheduledAds: 0,
        availableSlots: 0,
        totalSlots: 2
      }))
    }
  ];

  const toggleVehicleExpansion = (vehicleId: string) => {
    const newExpanded = new Set(expandedVehicles);
    if (newExpanded.has(vehicleId)) {
      newExpanded.delete(vehicleId);
    } else {
      newExpanded.add(vehicleId);
    }
    setExpandedVehicles(newExpanded);
  };

  const filteredVehicles = mockVehicles.filter(vehicle => {
    if (selectedVehicle && vehicle.vehicleId !== selectedVehicle) return false;
    if (statusFilter === 'online' && vehicle.status !== 'ONLINE') return false;
    if (statusFilter === 'offline' && vehicle.status === 'ONLINE') return false;
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'OFFLINE':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'MAINTENANCE':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-green-100 text-green-800';
      case 'OFFLINE':
        return 'bg-red-100 text-red-800';
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailabilityColor = (isAvailable: boolean, availableSlots: number, totalSlots: number) => {
    if (!isAvailable) return 'bg-red-100 text-red-800';
    if (availableSlots === totalSlots) return 'bg-green-100 text-green-800';
    if (availableSlots > 0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      {/* Summary Footer */}
      <div className="pb-3 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-green-100 p-4 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-gray-900">
              {filteredVehicles.filter(v => v.status === 'ONLINE').length}
            </div>
            <div className="text-sm text-gray-600">Online Vehicles</div>
          </div>
          <div className="bg-blue-100 p-4 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-gray-900">
              {filteredVehicles.reduce((sum, v) => sum + v.totalAvailableHours, 0)}h
            </div>
            <div className="text-sm text-gray-600">Total Available Hours</div>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg shadow-md">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(filteredVehicles.reduce((sum, v) => sum + v.utilizationRate, 0) / filteredVehicles.length) || 0}%
            </div>
            <div className="text-sm text-gray-600">Average Utilization</div>
          </div>
        </div>
      </div>
      <div className="p-6 border-b border-gray-200">

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              Available Airtime Per Hour Per Vehicle
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-32 text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                {statusOptions.find(opt => opt.value === statusFilter)?.label}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    showStatusDropdown ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>
              <AnimatePresence>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {statusOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.value as any);
                          setShowStatusDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                className="flex items-center justify-between w-40 text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                {timeOptions.find(opt => opt.value === timeFilter)?.label}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    showTimeDropdown ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>
              <AnimatePresence>
                {showTimeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {timeOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTimeFilter(opt.value as any);
                          setShowTimeDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Vehicle List */}
      <div className="divide-y divide-gray-200">
        {filteredVehicles.map((vehicle) => (
          <div key={vehicle.vehicleId} className="p-6 hover:bg-gray-50 ">
            {/* Vehicle Header */}
            <div 
              className="flex items-center justify-between cursor-pointer p-2 rounded-lg transition-colors"
              onClick={() => toggleVehicleExpansion(vehicle.vehicleId)}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {expandedVehicles.has(vehicle.vehicleId) ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                  <Car className="w-5 h-5 text-blue-500" />
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900">{vehicle.vehicleName}</h4>
                  <p className="text-sm text-gray-500">Driver: {vehicle.driverName} • {vehicle.currentLocation}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(vehicle.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {vehicle.totalAvailableHours}h available
                  </div>
                  <div className="text-xs text-gray-500">
                    {vehicle.utilizationRate}% utilization
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedVehicles.has(vehicle.vehicleId) && (
              <div className="mt-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-blue-900">
                      {vehicle.totalAvailableHours}h
                    </div>
                    <p className="text-sm font-medium text-blue-900">Total Available</p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-green-900">
                      {vehicle.totalScheduledHours}h
                    </div>
                    <p className="text-sm font-medium text-green-900 flex items-center gap-1">
                      Scheduled
                    </p>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-yellow-900">
                      {vehicle.utilizationRate}%
                    </div>
                    <p className="text-sm font-medium text-yellow-900 flex items-center gap-1">
                      Utilization
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {format(selectedDate, 'MMM dd')}
                    </div>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                      Date
                    </p>
                  </div>
                </div>


                {/* Hourly Schedule */}
                <div>
                  <h5 className="text-sm font-medium text-gray-900 mb-3">Hourly Availability Schedule</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {vehicle.hourlyAvailability
                      .filter(slot => {
                        if (timeFilter === 'available') return slot.isAvailable;
                        if (timeFilter === 'busy') return !slot.isAvailable;
                        return true;
                      })
                      .map((slot) => (
                        <div
                          key={slot.hour}
                          className={`p-3 rounded-lg bg-white/80 shadow-md text-center ${
                            slot.isAvailable 
                          }`}
                        >
                          <div className="text-xs font-medium text-gray-900 mb-1">
                            {slot.timeSlot}
                          </div>
                          
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${getAvailabilityColor(slot.isAvailable, slot.availableSlots, slot.totalSlots)}`}>
                            {slot.isAvailable ? 'Available' : 'Busy'}
                          </div>

                          <div className="text-xs text-gray-600">
                            <div>Slots: {slot.availableSlots}/{slot.totalSlots}</div>
                            {slot.scheduledAds > 0 && (
                              <div className="text-red-600">Ads: {slot.scheduledAds}</div>
                            )}
                          </div>

                          {slot.currentAd && (
                            <div
                              className={`mt-2 p-2 rounded text-xs ${
                                slot.isAvailable ? 'bg-green-100' : 'bg-red-100'
                              }`}
                            >
                              <div className="font-medium text-blue-900 truncate">
                                {slot.currentAd.adTitle}
                              </div>
                              <div className="text-blue-700">
                                {formatTime(slot.currentAd.remainingTime)} left
                              </div>
                            </div>
                          )}

                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirtimeAvailability;