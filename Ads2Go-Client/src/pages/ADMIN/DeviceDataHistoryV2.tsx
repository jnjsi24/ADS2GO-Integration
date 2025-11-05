import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Calendar,
  RefreshCw,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
  MapPin,
  TrendingUp,
  Clock,
  Monitor, 
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { AdminLoader } from "../../components/ProtectedRoute";
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface DailyData {
  date: string;
  totalAdPlays: number;
  totalQRScans: number;
  totalDistanceTraveled: number;
  totalHoursOnline: number;
  totalAdImpressions: number;
  totalAdPlayTime: number;
  networkStatus?: {
    isOnline: boolean;
    connectionType?: string;
    signalStrength?: number;
  };
  complianceData?: {
    offlineIncidents: number;
    displayIssues: number;
  };
}

interface Material {
  _id?: string;
  materialId: string;
  carGroupId: string;
  dailyData: DailyData[];
  lifetimeTotals?: {
    totalAdPlays: number;
    totalQRScans: number;
    totalDistanceTraveled: number;
    totalHoursOnline: number;
    totalAdImpressions?: number;
    totalAdPlayTime?: number;
    totalDays?: number;
    averageDailyHours?: number;
    complianceRate?: number;
  };
  // MongoDB returns these by default, so we can use them if available
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastDataUpdate?: string | Date;
  lastArchiveUpdate?: string | Date;
  totalUpdates?: number;
  __v?: number;
}

const DeviceDataHistoryV2: React.FC = () => {
  const { admin, isLoading: authLoading } = useAdminAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Set default date to empty to show all data
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);

  // Device filter state
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState('All Device');
  const [deviceFilterOptions, setDeviceFilterOptions] = useState<string[]>(['All Device']);

  // Date dropdown state
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10000; // Large number to fetch all data

  const [editingData, setEditingData] = useState<{ materialId: string; date: string; data: DailyData } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ materialId: string; date: string } | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache



  // Get base API URL without /graphql
  const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace('/graphql', '').replace(/\/$/, '');

  // Show toast notification
  const showToast = (message: string) => {
    setToastMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  // Log API URL on mount for debugging
  useEffect(() => {
    console.log('🔧 DeviceDataHistoryV2 - API_URL:', API_URL);
    console.log('🔧 DeviceDataHistoryV2 - Full API endpoint:', `${API_URL}/api/deviceDataHistoryV2/materials`);
  }, []);

  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch materials data with server-side pagination and filtering
  const fetchMaterials = async (forceRefresh = false) => {
    // Check cache validity (skip for filters/pagination changes)
    if (!forceRefresh && lastFetch && (Date.now() - lastFetch.getTime() < CACHE_DURATION)) {
      if (currentPage === 1 && !debouncedSearch && !selectedDate && selectedDeviceFilter === 'All Device') {
        return; // Use cached data for default view
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Fetch all data
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      if (selectedDate) {
        params.append('startDate', selectedDate);
        params.append('endDate', selectedDate);
      }

      if (selectedDeviceFilter !== 'All Device') {
        params.append('materialId', selectedDeviceFilter);
      }

      const response = await axios.get(
        `${API_URL}/api/deviceDataHistoryV2/materials?${params.toString()}`
      );

      console.log('Fetched materials response:', response.data); // Add this log
      if (response.data.success) {
        setMaterials(response.data.materials);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.totalCount || 0);
          setLastFetch(new Date());
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when dependencies change
  useEffect(() => {
    fetchMaterials();
  }, [currentPage, debouncedSearch, selectedDate, selectedDeviceFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedDate, selectedDeviceFilter]);

  useEffect(() => {
    if (materials.length > 0) {
      const deviceIds = Array.from(new Set(materials.map(material => material.materialId)));
      console.log('📱 Extracted devices from materials:', deviceIds);
      setDeviceFilterOptions(['All Device', ...deviceIds]);
      console.log('Updated deviceFilterOptions:', ['All Device', ...deviceIds]);

      // Extract all unique dates from all materials' dailyData
      const allDates = new Set<string>();
      materials.forEach(material => {
        material.dailyData.forEach(day => {
          const dateStr = new Date(day.date).toISOString().split('T')[0];
          allDates.add(dateStr);
        });
      });
      
      // Sort dates in descending order (newest first)
      const sortedDates = Array.from(allDates).sort((a, b) => {
        return new Date(b).getTime() - new Date(a).getTime();
      });
      
      setAvailableDates(sortedDates);
      console.log('📅 Available dates:', sortedDates);
    }
  }, [materials]);

  // Handle edit
  const handleEdit = (materialId: string, date: string | Date, data: DailyData) => {
    // Ensure date is a string
    const dateString = typeof date === 'string' ? date : new Date(date).toISOString();
    console.log('Edit clicked:', { materialId, date: dateString, data });
    setEditingData({ materialId, date: dateString, data: { ...data } });
    setShowEditModal(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingData) {
      console.error('No editing data found');
      showToast('❌ Error: No data to save');
      return;
    }

    setIsSaving(true);
    console.log('=== SAVE EDIT DEBUG ===');
    console.log('1. Editing data:', editingData);
    console.log('2. API_URL:', API_URL);

    try {
      const dateStr = new Date(editingData.date).toISOString().split('T')[0];
      const url = `${API_URL}/api/deviceDataHistoryV2/materials/${editingData.materialId}/daily-data/${dateStr}`;
      
      // Check if the date is today
      const today = new Date().toISOString().split('T')[0];
      const isToday = dateStr === today;
      
      console.log('3. PUT request to:', url);
      console.log('4. Data being sent:', editingData.data);
      console.log('5. Date check - Today:', today, 'Editing:', dateStr, 'Is Today:', isToday);

      const response = await axios.put(url, editingData.data);

      console.log('6. Response status:', response.status);
      console.log('7. Response data:', response.data);

      if (response.data.success) {
        // Update local state
        setMaterials(prevMaterials => 
          prevMaterials.map(material => {
            if (material.materialId === editingData.materialId) {
              return {
                ...material,
                dailyData: material.dailyData.map(day => {
                  const dayDate = new Date(day.date).toISOString().split('T')[0];
                  if (dayDate === dateStr) {
                    return { ...editingData.data, date: day.date };
                  }
                  return day;
                })
              };
            }
            return material;
          })
        );
        
        console.log('8. ✅ Update successful! Closing modal...');
        
        // Show appropriate success message based on update type
        const updateType = response.data.data?.updateType;
        if (updateType === 'current_date') {
          showToast('✅ Current date data updated! (DeviceTracking + DeviceDataHistoryV2)');
        } else if (updateType === 'past_date') {
          showToast('✅ Past date data updated! (DeviceDataHistoryV2)');
        } else {
          showToast('✅ Data updated successfully!');
        }
        
        setShowEditModal(false);
        setEditingData(null);
        
        // Optionally refresh data
        setTimeout(() => {
          fetchMaterials(true);
        }, 1000);
      } else {
        console.error('9. ❌ Server returned success: false');
        showToast('❌ Failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('10. ❌ ERROR updating daily data:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update data';
      showToast(`❌ Error: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!showDeleteConfirm) return;

    try {
      const dateStr = new Date(showDeleteConfirm.date).toISOString().split('T')[0];
      const response = await axios.delete(
        `${API_URL}/api/deviceDataHistoryV2/materials/${showDeleteConfirm.materialId}/daily-data/${dateStr}`
      );

      if (response.data.success) {
        // Update local state
        setMaterials(prevMaterials => 
          prevMaterials.map(material => {
            if (material.materialId === showDeleteConfirm.materialId) {
              return {
                ...material,
                dailyData: material.dailyData.filter(day => {
                  const dayDate = new Date(day.date).toISOString().split('T')[0];
                  return dayDate !== dateStr;
                })
              };
            }
            return material;
          })
        );
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting daily data:', error);
      showToast('Failed to delete data. Please try again.');
    }
  };

  // Toggle expand/collapse for material dailyData
  const toggleMaterialExpansion = (materialId: string) => {
    setExpandedMaterials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  // Calculate margin based on screen size
  const contentMargin = isMobile ? 'ml-0' : 'ml-60';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Only block navigation for auth loading, not data loading
  if (authLoading) {
    return <AdminLoader />;
  }

  return (
    <div className={`flex flex-col ${contentMargin} bg-[#f9f9fc] min-h-screen text-gray-800 font-sans transition-all duration-300`}>
      <div className="p-6 pb-4">
        {/* Header & Filters Combined Layout */}
        <div className="pt-3">
        {/* Row 1: Title + Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          {/* Left: Title */}
          <h1 className="text-3xl mt-2 font-bold text-gray-800">
            Device Data History
          </h1>

          {/* Right: Search + Date Picker */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search by Material ID or Car Group ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs text-black rounded-md pl-4 py-3 shadow-md focus:outline-none bg-white"
              />
              {searchTerm !== debouncedSearch && (
                <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
              )}
            </div>

            <div className="relative flex-1 sm:flex-none sm:w-40">
              <button
                onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedDeviceFilter}</span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showDeviceDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showDeviceDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {deviceFilterOptions.map((device) => (
                      <button
                        key={device}
                        onClick={() => {
                          setSelectedDeviceFilter(device);
                          setShowDeviceDropdown(false);
                          setCurrentPage(1);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {device}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Date Dropdown */}
            <div className="relative w-full sm:w-40">
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate text-sm text-gray-700">
                  {selectedDate
                    ? new Date(selectedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : "All Dates"}
                </span>
                <div className="flex items-center gap-1">
                  {selectedDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate("");
                        setShowDateDropdown(false);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                      title="Clear date filter"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transform transition-transform duration-200 ${showDateDropdown ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {showDateDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                  >
                    <button
                      onClick={() => {
                        setSelectedDate("");
                        setShowDateDropdown(false);
                        setCurrentPage(1);
                      }}
                      className={`block w-full text-left px-4 py-2 text-xs transition-colors duration-150 ${
                        !selectedDate
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      All Dates
                    </button>
                    {availableDates.map((date) => {
                      const dateObj = new Date(date);
                      const isSelected = selectedDate === date;
                      return (
                        <button
                          key={date}
                          onClick={() => {
                            setSelectedDate(date);
                            setShowDateDropdown(false);
                            setCurrentPage(1);
                          }}
                          className={`block w-full text-left px-4 py-2 text-xs transition-colors duration-150 ${
                            isSelected
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {dateObj.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Row 2: Refresh Button (Right aligned) */}
        <div className="flex justify-end">
          <button
            onClick={() => fetchMaterials(true)}
            className="px-4 py-2 bg-[#3674B5] text-white rounded-md shadow-lg hover:bg-[#3674B5]/80 disabled:opacity-50 flex items-center gap-2"
            title={lastFetch ? `Last updated: ${lastFetch.toLocaleTimeString()}` : 'Refresh data'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        </div>
      </div>

      {/* Data Table - Structured like Database */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-[#3674B5] animate-spin mb-3" />
              <p className="text-gray-600">Loading device data...</p>
            </div>
          ) : materials.length > 0 ? (
            <div className="space-y-4">
              {materials.map((material, index) => {
                const isExpanded = expandedMaterials.has(material.materialId);
                const filteredDailyData = selectedDate 
                  ? material.dailyData.filter(day => {
                      const dayDate = new Date(day.date).toISOString().split('T')[0];
                      return dayDate === selectedDate;
                    })
                  : material.dailyData;

                return (
                  <motion.div
                    key={material._id || material.materialId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden"
                  >
                    {/* Main Material Row */}
                    <div className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <button
                            onClick={() => toggleMaterialExpansion(material.materialId)}
                            className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-200 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="w-5 h-5 text-gray-600" />
                            ) : (
                              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
                            )}
                          </button>
                          
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Material ID</p>
                              <p className="text-sm font-semibold text-gray-900">{material.materialId}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Car Group</p>
                              <p className="text-sm text-gray-700">{material.carGroupId}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Daily Data</p>
                              <p className="text-sm text-gray-700">Array ({material.dailyData.length})</p>
                            </div>
                            {material.lifetimeTotals && (
                              <>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase mb-1">Total Ad Plays</p>
                                  <p className="text-sm text-gray-700">{material.lifetimeTotals.totalAdPlays || 0}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase mb-1">Total Distance</p>
                                  <p className="text-sm text-gray-700">{(material.lifetimeTotals.totalDistanceTraveled || 0).toFixed(2)} km</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 uppercase mb-1">Total Hours</p>
                                  <p className="text-sm text-gray-700">{(material.lifetimeTotals.totalHoursOnline || 0).toFixed(2)}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Metadata - Only show if available from backend */}
                        {(material.createdAt || material.updatedAt || material.totalUpdates !== undefined) && (
                          <div className="hidden lg:flex flex-col items-end gap-1 text-xs text-gray-500">
                            {material.createdAt && (
                              <p>Created: {new Date(material.createdAt).toLocaleDateString()}</p>
                            )}
                            {material.updatedAt && (
                              <p>Updated: {new Date(material.updatedAt).toLocaleDateString()}</p>
                            )}
                            {material.totalUpdates !== undefined && (
                              <p>Updates: {material.totalUpdates}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Daily Data Section */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <div className="mb-3">
                              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                                Daily Data ({filteredDailyData.length} entries)
                              </h3>
                              {material.lifetimeTotals && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white rounded mb-3">
                                  <div>
                                    <p className="text-xs text-gray-500">Lifetime Totals</p>
                                    <p className="text-sm font-medium">Ad Plays: {material.lifetimeTotals.totalAdPlays || 0}</p>
                                    <p className="text-sm font-medium">QR Scans: {material.lifetimeTotals.totalQRScans || 0}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Distance</p>
                                    <p className="text-sm font-medium">{(material.lifetimeTotals.totalDistanceTraveled || 0).toFixed(2)} km</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Hours Online</p>
                                    <p className="text-sm font-medium">{(material.lifetimeTotals.totalHoursOnline || 0).toFixed(2)}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-white">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Ad Plays</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">QR Scans</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Distance (km)</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Hours Online</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredDailyData.length > 0 ? (
                                    filteredDailyData.map((dailyData, dayIndex) => (
                                      <tr key={dayIndex} className="border-b border-gray-200 hover:bg-white transition-colors">
                                        <td className="px-4 py-2">{formatDate(dailyData.date)}</td>
                                        <td className="px-4 py-2">{dailyData.totalAdPlays || 0}</td>
                                        <td className="px-4 py-2">{dailyData.totalQRScans || 0}</td>
                                        <td className="px-4 py-2">{(dailyData.totalDistanceTraveled || 0).toFixed(2)}</td>
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            {(dailyData.totalHoursOnline || 0).toFixed(2)}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => handleEdit(material.materialId, dailyData.date, dailyData)}
                                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                              title="Edit"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => setShowDeleteConfirm({
                                                materialId: material.materialId,
                                                date: dailyData.date,
                                              })}
                                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                              title="Delete"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                                        No daily data found {selectedDate && `for ${selectedDate}`}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Database className="w-12 h-12 text-gray-300 mb-2" />
              <p className="text-gray-500">No data found</p>
              <p className="text-sm text-gray-400">Try adjusting your filters</p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Pagination - Sticky at Bottom */}
      {materials.length > 0 && (
        <div className="sticky bottom-0 bg-[#f9f9fc] z-10 py-4 px-6 shadow-lg">
          <div className="flex justify-center">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center px-2 sm:px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <div className="flex space-x-1">
                {(() => {
                  const pages = [];
                  const maxVisiblePages = isMobile ? 1 : 3;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`px-2 sm:px-3 py-1 text-sm rounded ${
                          currentPage === i ? 'border border-gray-300 text-black' : 'text-gray-700 hover:border border-gray-300'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  if (endPage < totalPages && !isMobile) {
                    pages.push(<span key="ellipsis" className="px-2 text-gray-500">…</span>);
                  }
                  return pages;
                })()}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center px-2 sm:px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && editingData && (() => {
          console.log('Rendering modal with editingData:', editingData);
          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-800">Edit Daily Data</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Material: {editingData?.materialId || 'N/A'} | Date: {editingData?.date ? formatDate(editingData.date) : 'N/A'}
                </p>
                {editingData && (() => {
                  const today = new Date().toISOString().split('T')[0];
                  const dateStr = new Date(editingData.date).toISOString().split('T')[0];
                  const isToday = dateStr === today;
                  
                  return (
                    <div className={` rounded-md text-sm font-medium ${
                      isToday 
                        ? ' text-blue-800' 
                        : ' text-orange-800'
                    }`}>
                      {isToday ? (
                        <>
                          <strong>Current Date:</strong> Will update DeviceTracking (real-time) + DeviceDataHistoryV2
                        </>
                      ) : (
                        <>
                          <strong>Past Date:</strong> Will update DeviceDataHistoryV2 (historical data only)
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Ad Plays
                    </label>
                    <input
                      type="number"
                      value={editingData.data.totalAdPlays || 0}
                      onChange={(e) => setEditingData({
                        ...editingData,
                        data: { ...editingData.data, totalAdPlays: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-[#3674B5]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total QR Scans
                    </label>
                    <input
                      type="number"
                      value={editingData.data.totalQRScans || 0}
                      onChange={(e) => setEditingData({
                        ...editingData,
                        data: { ...editingData.data, totalQRScans: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-[#3674B5]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Distance Traveled (km)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingData.data.totalDistanceTraveled || 0}
                      onChange={(e) => setEditingData({
                        ...editingData,
                        data: { ...editingData.data, totalDistanceTraveled: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-[#3674B5]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Hours Online
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingData.data.totalHoursOnline || 0}
                      onChange={(e) => setEditingData({
                        ...editingData,
                        data: { ...editingData.data, totalHoursOnline: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-[#3674B5]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Ad Impressions
                    </label>
                    <input
                      type="number"
                      value={editingData.data.totalAdImpressions || 0}
                      onChange={(e) => setEditingData({
                        ...editingData,
                        data: { ...editingData.data, totalAdImpressions: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-[#3674B5]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Ad Play Time (seconds)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingData.data.totalAdPlayTime || 0}
                      onChange={(e) => setEditingData({
                        ...editingData,
                        data: { ...editingData.data, totalAdPlayTime: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-[#3674B5]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-between gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingData(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                    isSaving 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-[#3674B5] text-white hover:bg-[#2563A0]'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-md shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Delete Daily Data</h2>
                  </div>
                </div>

                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete the data for{' '}
                  <span className="font-semibold">{showDeleteConfirm.materialId}</span> on{' '}
                  <span className="font-semibold">{formatDate(showDeleteConfirm.date)}</span>?
                </p>

                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Toast Notification */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className="bg-white border-l-4 border-green-500 rounded-md shadow-xl px-6 py-4 flex items-center gap-3 min-w-[300px]">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{toastMessage}</p>
              </div>
              <button
                onClick={() => setShowSuccessToast(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeviceDataHistoryV2;