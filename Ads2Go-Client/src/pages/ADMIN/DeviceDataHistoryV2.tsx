import React, { useState, useEffect, useRef } from 'react';
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
  Monitor, ChevronDown
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
  _id: string;
  materialId: string;
  carGroupId: string;
  dailyData: DailyData[];
  lifetimeTotals?: {
    totalAdPlays: number;
    totalQRScans: number;
    totalDistanceTraveled: number;
    totalHoursOnline: number;
  };
}

const DeviceDataHistoryV2: React.FC = () => {
  const { admin, isLoading: authLoading } = useAdminAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Set default date to today
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);

  // Device filter state
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState('All Device');
  const [deviceFilterOptions, setDeviceFilterOptions] = useState<string[]>(['All Device']);

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 9;

  const [editingData, setEditingData] = useState<{ materialId: string; date: string; data: DailyData } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ materialId: string; date: string } | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleButtonClick = () => {
    inputRef.current?.showPicker(); // Opens the native date picker
  };



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
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
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
      alert('Failed to delete data. Please try again.');
    }
  };

  // Get all daily data items for display (server already paginated)
  const allDailyDataItems: Array<{ material: Material; dailyData: DailyData }> = [];
  materials.forEach(material => {
    material.dailyData.forEach(dailyData => {
      allDailyDataItems.push({ material, dailyData });
    });
  });
  
  const currentItems = allDailyDataItems;

  // Calculate margin based on screen size
  const contentMargin = isMobile ? 'ml-0' : 'pl-72';

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
    <div className={`p-6 ${contentMargin} bg-[#f9f9fc] min-h-screen text-gray-800 font-sans transition-all duration-300`}>
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

            {/* Date Picker */}
            <div className="relative w-full sm:w-40">
              <button
                onClick={handleButtonClick}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <div className="flex items-center">
                  <span className="text-sm text-gray-700">
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString()
                      : "Select Date"}
                  </span>
                </div>

                {selectedDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Clear date filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </button>

              {/* Hidden native date input */}
              <input
                ref={inputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute opacity-0 left-6 pointer-events-none"
              />
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

      {/* Data Table */}
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-3"> {/* adds spacing between rows */}
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Material ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Car Group
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ad Plays
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  QR Scans
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Distance (km)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Hours Online
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 text-[#3674B5] animate-spin" />
                      <p className="text-gray-600">Loading device data...</p>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <motion.tr
                    key={`${item.material.materialId}-${item.dailyData.date}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap rounded-l-lg">
                      <span className="text-sm font-medium text-gray-900">
                        {item.material.materialId}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{item.material.carGroupId}</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{formatDate(item.dailyData.date)}</span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.dailyData.totalAdPlays || 0}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.dailyData.totalQRScans || 0}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(item.dailyData.totalDistanceTraveled || 0).toFixed(2)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {(item.dailyData.totalHoursOnline || 0).toFixed(2)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap rounded-r-lg">
                    <div className="flex items-center gap-3">
                      {/* Edit Button */}
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <button
                          onClick={() =>
                            handleEdit(item.material.materialId, item.dailyData.date, item.dailyData)
                          }
                          className="group flex items-center text-gray-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                        >
                          <Edit2
                            size={16}
                            className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                          />
                          <span className="absolute left-6 opacity-0 group-hover:opacity-100 text-xs transition-opacity duration-300 whitespace-nowrap">
                            Edit
                          </span>
                        </button>
                      </div>

                      {/* Delete Button */}
                      <div className="relative w-8 h-8 flex items-center justify-center">
                        <button
                          onClick={() =>
                            setShowDeleteConfirm({
                              materialId: item.material.materialId,
                              date: item.dailyData.date,
                            })
                          }
                          className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                        >
                          <Trash2
                            size={16}
                            className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                          />
                          <span className="absolute left-6 opacity-0 group-hover:opacity-100 text-xs transition-opacity duration-300 whitespace-nowrap">
                            Delete
                          </span>
                        </button>
                      </div>
                    </div>
                  </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Database className="w-12 h-12 text-gray-300" />
                      <p className="text-gray-500">No data found</p>
                      <p className="text-sm text-gray-400">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
              </div>

      {/* Pagination */}
      {materials.length > 0 && (
        <div className="mt-auto flex justify-center py-4">
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
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
                    <div className={` rounded-lg text-sm font-medium ${
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Delete Daily Data</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete the data for{' '}
                  <span className="font-semibold">{showDeleteConfirm.materialId}</span> on{' '}
                  <span className="font-semibold">{formatDate(showDeleteConfirm.date)}</span>?
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
            <div className="bg-white border-l-4 border-green-500 rounded-lg shadow-xl px-6 py-4 flex items-center gap-3 min-w-[300px]">
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