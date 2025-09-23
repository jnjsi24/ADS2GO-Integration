import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';
import { CREATE_AD } from '../../graphql/admin/mutations/createAd';
import { motion, AnimatePresence } from 'framer-motion';


// Form data type
type FormData = {
  title: string;
  description: string;
  vehicleType: string;
  materialsUsed: string;
  adFormat: string;
  plan: string;
  media: File | null;
  status: 'PENDING';
};

// Toast notification type
type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

// Ad type
type Ad = {
  id: string;
  title: string;
  description: string;
  adFormat: string;
  mediaFile?: string;
  adType: string;
  vehicleType: string;
  price: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING';
  createdAt: string;
  startTime: string;  // Added start date
  endTime: string;    // Added end date
  planId: {
    id: string;
    name: string;
    durationDays: number;
    playsPerDayPerDevice: number;
    numberOfDevices: number;
    adLengthSeconds: number;
    pricePerPlay: number;
    totalPrice: number;
  };
  materialId: {
    id: string;
    materialType: string;
    category: string;
    description: string;
    mountedAt: string;
    dismountedAt: string;
  };
};

const planFilterOptions = ['All Plans', 'Basic Plan', 'Backseat Spotlight Plan'];
const statusFilterOptions = ['All Status', 'Pending', 'Approved', 'Rejected', 'Running'];

const Advertisements: React.FC = () => {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [searchTerm, setSearchTerm] = useState('');
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('All Plans');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  // Date filter state removed as per request
  const [dateFilter, setDateFilter] = useState('');
  const [showCreateAdPopup, setShowCreateAdPopup] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vehicleType: '',
    materialsUsed: '',
    adFormat: '',
    plan: '',
    media: null as File | null,
    status: 'PENDING' as const,
  });
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const { data, loading, error } = useQuery(GET_MY_ADS);
  const [createAd] = useMutation(CREATE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
  });
  
  const ads: Ad[] = data?.getMyAds || [];
  
  // Fixed format date function to handle both timestamp strings and date strings
  const formatDate = (dateValue: string | number) => {
    if (!dateValue) return 'N/A';
    
    try {
      let date: Date;
      
      // Check if it's a timestamp string (all digits)
      if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
        // Convert timestamp string to number and create date
        date = new Date(parseInt(dateValue));
      } else if (typeof dateValue === 'number') {
        // Handle numeric timestamp
        date = new Date(dateValue);
      } else {
        // Handle regular date string
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      const options: Intl.DateTimeFormatOptions = { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateValue);
      return 'Invalid Date';
    }
  };

  // Format date range for display
  const formatDateRange = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 'Dates not set';
    try {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      if (start === 'Invalid Date' || end === 'Invalid Date') return 'Invalid Date Range';
      return `${start} - ${end}`;
    } catch (error) {
      return 'Invalid Date Range';
    }
  };

  const materialOptionsMap: Record<string, string[]> = {
    Car: ['LCD Screen', 'Posters', 'Vinyl Sticker'],
    Motor: ['Posters', 'Vinyl Sticker'],
    Jeep: ['Posters', 'Vinyl Sticker'],
    Bus: ['LCD Screen', 'Posters'],
  };

  const priceMap: Record<string, Record<string, Record<string, number>>> = {
    Car: {
      'LCD Screen': { Weekly: 64, Monthly: 200 },
      Posters: { Weekly: 35, Monthly: 100 },
      'Vinyl Sticker': { Weekly: 40, Monthly: 120 },
    },
    Motor: {
      Posters: { Weekly: 20, Monthly: 60 },
      'Vinyl Sticker': { Weekly: 25, Monthly: 70 },
    },
    Jeep: {
      Posters: { Weekly: 30, Monthly: 90 },
      'Vinyl Sticker': { Weekly: 35, Monthly: 100 },
    },
    Bus: {
      'LCD Screen': { Weekly: 80, Monthly: 250 },
      Posters: { Weekly: 45, Monthly: 130 },
    },
  };

  const [materialsOptions, setMaterialsOptions] = useState<string[]>([]);

  useEffect(() => {
    if (formData.vehicleType) {
      setMaterialsOptions(materialOptionsMap[formData.vehicleType] || []);
      setFormData(prev => ({ ...prev, materialsUsed: '' }));
    }
  }, [formData.vehicleType]);

  useEffect(() => {
    const { vehicleType, materialsUsed, plan } = formData;
    const price = priceMap[vehicleType]?.[materialsUsed]?.[plan] ?? null;
    setEstimatedPrice(price);
  }, [formData.vehicleType, formData.materialsUsed, formData.plan]);

  const addToast = (message: string, type: 'error' | 'success') => {
    const id = Date.now();
    setToasts((prev: Toast[]) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev: Toast[]) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts((prev: Toast[]) => prev.filter((toast) => toast.id !== id));
  };

  const handleDeleteAd = async (adId: string) => {
    try {
      // Handle delete ad logic here
      console.log('Deleting ad:', adId);
      setToasts((prev: Toast[]) => [...prev, { 
        id: Date.now(), 
        message: 'Ad deleted successfully!', 
        type: 'success' as const 
      }]);
    } catch (error) {
      console.error('Error deleting ad:', error);
      setToasts((prev: Toast[]) => [...prev, { 
        id: Date.now(), 
        message: 'Failed to delete ad', 
        type: 'error' as const 
      }]);
    }
  };

  const handleViewAd = (ad: Ad) => {
    navigate(`/advertisements/${ad.id}`);
  };

  const showConfirmModal = (message: string, callback: () => void) => {
    if (window.confirm(message)) {
      callback();
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  // Helper function to parse ad date string (removed as no longer needed)
  const parseAdDate = (dateString: string): Date => {
    // Handle timestamp strings
    if (/^\d+$/.test(dateString)) {
      return new Date(parseInt(dateString));
    }
    // Example: "31 Jul 2020" -> "Jul 31 2020" for Date constructor
    const parts = dateString.split(' ');
    const formattedDateString = `${parts[1]} ${parts[0]} ${parts[2]}`;
    return new Date(formattedDateString);
  };

  // Helper functions for date comparisons
  const isSameDay = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() &&
              d1.getMonth() === d2.getMonth() &&
              d1.getDate() === d2.getDate();
  };

  const isSameWeek = (d1: Date, d2: Date): boolean => {
    const startOfWeek1 = new Date(d1);
    startOfWeek1.setDate(d1.getDate() - d1.getDay()); // Go to Sunday of the week
    startOfWeek1.setHours(0, 0, 0, 0);

    const startOfWeek2 = new Date(d2);
    startOfWeek2.setDate(d2.getDate() - d2.getDay()); // Go to Sunday of the week
    startOfWeek2.setHours(0, 0, 0, 0);

    return isSameDay(startOfWeek1, startOfWeek2);
  };

  const isSameMonth = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() &&
              d1.getMonth() === d2.getMonth();
  };

  const isSameYear = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear();
  };

  const filteredAds = ads.filter((ad: Ad) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      ad.title.toLowerCase().includes(searchLower) ||
      ad.description.toLowerCase().includes(searchLower);
    
    const matchesPlan = selectedPlanFilter === 'All Plans' || ad.planId.name.toLowerCase() === selectedPlanFilter.toLowerCase();
    const matchesStatus = selectedStatusFilter === 'All Status' || ad.status.toLowerCase() === selectedStatusFilter.toLowerCase();

    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  if (loading) return <div className="min-h-screen bg-white pl-64 pr-5 pt-10">Loading ads...</div>;
  if (error) return <div className="min-h-screen bg-white pl-64 pr-5 pt-10 text-red-600">Error loading ads: {error.message}</div>;
  const currentAds = filteredAds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAds.length / itemsPerPage);

  const startItem = indexOfFirstItem + 1;
  const endItem = Math.min(indexOfLastItem, filteredAds.length);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePlanFilterChange = (plan: string) => {
    setSelectedPlanFilter(plan);
    setShowPlanDropdown(false);
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const formatStatus = (status: string): string => {
    if (!status) return '';
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, files } = target;
    
    if (name === 'media' && files && files.length > 0) {
      setFormData((prev: FormData) => ({ ...prev, media: files[0] }));
    } else if (name in formData) {
      setFormData((prev: FormData) => ({
        ...prev,
        [name]: name === 'status' ? value.toUpperCase() : value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Please enter a title', type: 'error' }]);
      return;
    }
    if (!formData.description.trim()) {
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Please enter a description', type: 'error' }]);
      return;
    }
    if (!formData.materialsUsed) {
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Please select a material', type: 'error' }]);
      return;
    }
    if (!formData.plan) {
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Please select a plan', type: 'error' }]);
      return;
    }
    if (!formData.adFormat) {
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Please select an ad format', type: 'error' }]);
      return;
    }
    if (!formData.media) {
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Please upload a media file', type: 'error' }]);
      return;
    }
    
    try {
      // For now, redirect to the proper create advertisement page
      setToasts((prev: Toast[]) => [...prev, { 
        id: Date.now(), 
        message: 'Please use the "Create Advertisement" page for full functionality', 
        type: 'error' 
      }]);
      setShowCreateAdPopup(false);
    } catch (error) {
      console.error('Error creating ad:', error);
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Failed to create ad', type: 'error' }]);
    }
  };

  return (
    <div className="min-h-screen bg-white pl-64 pr-5">
      <div className="bg-white w-full min-h-screen">
      {/* Header with Title*/}
      <div className="flex justify-between items-center mb-6 pt-10">
        <h1 className="text-3xl ml-5 font-bold text-gray-800">Advertisements</h1>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-1">
            <input
              type="text"
              className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
              placeholder="Search Advertisements"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Filter for Plans */}
            <div className="relative w-32">
              <button
                onClick={() => setShowPlanDropdown(!showPlanDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
                {selectedPlanFilter}
                <ChevronDown size={16} className={`transform transition-transform duration-200 ${showPlanDropdown ? 'rotate-180' : 'rotate-0'}`} />
              </button>
              <AnimatePresence>
                {showPlanDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {planFilterOptions.map((plan) => (
                      <button
                        key={plan}
                        onClick={() => handlePlanFilterChange(plan)}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {plan}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filter for Status */}
            <div className="relative w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
                {selectedStatusFilter}
                <ChevronDown size={16} className={`transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : 'rotate-0'}`} />
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
                    {statusFilterOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusFilterChange(status)}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {status}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Material Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => navigate('/create-advertisement')}
          className="py-3 bg-[#feb011] text-xs text-white rounded-lg w-40 hover:bg-[#FF9B45] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Add New Ads
        </button>
      </div>
      

      {/* Ad Cards */}
      <div className=" bg-white p-6 grid grid-cols-4 gap-6">
        {currentAds.length > 0 ? (
          currentAds.map((ad) => (
            <div
              key={ad.id}
              className=" overflow-hidden rounded-lg shadow-md cursor-pointer relative flex flex-col h-full hover:scale-105 transition-all duration-300"
            >
              <div className="w-full h-48 flex-shrink-0 relative">
                {/* Fixed media display based on ManageAds.tsx */}
                {ad.mediaFile ? (
                  ad.adFormat === 'IMAGE' ? (
                    <img
                      src={ad.mediaFile}
                      alt={`${ad.title} image`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                      }}
                    />
                  ) : ad.adFormat === 'VIDEO' ? (
                    <video
                      className="w-full h-full object-cover"
                      controls
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'w-full h-full bg-gray-500 flex items-center justify-center text-white';
                        errorDiv.innerHTML = 'Video not available';
                        e.currentTarget.parentNode?.appendChild(errorDiv);
                      }}
                    >
                      <source src={ad.mediaFile} />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="w-full h-full bg-gray-500 flex items-center justify-center">
                      <a 
                        href={ad.mediaFile} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-white hover:text-gray-300 underline"
                      >
                        View Media File
                      </a>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white">
                    No Media
                  </div>
                )}
              </div>

              <div className="p-4 bg-white flex-grow flex flex-col">
                <div
                  className="flex-grow cursor-pointer"
                  onClick={() => navigate(`/ad-details/${ad.id}`)}
                >
                  <h3 className="text-2xl font-semibold text-black">{ad.title}</h3>
                  <p className="text-md text-gray-600">{ad.planId?.name} Plan</p>
                </div>

                {/* Campaign info fixed above button */}
                {ad.startTime && ad.endTime ? (
                  <p className="text-sm text-blue-600 mt-5 mb-2 font-medium">
                    Campaign: {formatDateRange(ad.startTime, ad.endTime)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 mt-5 mb-2">
                    Campaign dates: Not available
                  </p>
                )}

                <div className="mt-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/ad-details/${ad.id}`);
                    }}
                    className="text-gray-500 text-xs font-semibold rounded-md px-4 py-2 flex items-center justify-center w-full hover:bg-[#1B5087] hover:text-white transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              </div>


              <span className={`absolute top-2 left-2 inline-block px-2 py-1 text-xs font-semibold rounded-lg ${
                ad.status === 'PENDING' ? 'bg-yellow-200 text-yellow-800' : 
                ad.status === 'APPROVED' ? 'bg-blue-200 text-blue-800' :
                ad.status === 'REJECTED' ? 'bg-red-200 text-red-800' :
                ad.status === 'RUNNING' ? 'bg-green-200 text-green-800' :
                'bg-gray-200 text-gray-800'}`}>
                {formatStatus(ad.status)}
              </span>
            </div>
          ))
        ) : (
          <div className="col-span-4 text-center text-gray-500">
            No advertisements found for the selected filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 rounded-lg mt-6 flex justify-between items-center">
        <span className="text-gray-500">
          Showing {startItem}-{endItem} of {filteredAds.length}
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            «
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-2 py-1 border border-gray-300 rounded ${
                currentPage === page ? 'bg-[#3674B5] text-white' : ''
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            »
          </button>
        </div>
      </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`text-white px-4 py-2 rounded-md shadow-lg flex items-center justify-between max-w-xs animate-slideIn ${toast.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Create Ad Popup - Right Side Version (Updated layout) */}
      {showCreateAdPopup && (
        <div className="fixed inset-0 z-50 flex justify-end pr-2 ">
          {/* Overlay with click-to-close functionality */}
          <div
            className="fixed inset-0 bg-black bg-opacity-30"
            onClick={() => setShowCreateAdPopup(false)}
          ></div>

          {/* Form container sliding in from right */}
          <div className="relative w-full max-w-xl h-[730px] pb-6 rounded-3xl bg-gray-200 mt-2 shadow-lg animate-slideIn">
            <div className="p-6 h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Create New Advertisement</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 mt-9">
                
                {/* Title */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="title" className="text-sm font-medium text-gray-700">Title</label>
                  <input
                    id="title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="description" className="text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                    rows={3}
                  />
                </div>

                {/* Vehicle Type */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="vehicleType" className="text-sm font-medium text-gray-700">Vehicle Type</label>
                  <select
                    id="vehicleType"
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleChange}
                    className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  >
                    <option value="">Select Vehicle Type</option>
                    <option value="Car">Car</option>
                    <option value="Motor">Motor</option>
                    <option value="Jeep">Jeep</option>
                    <option value="Bus">Bus</option>
                  </select>
                </div>

                {/* Materials Used */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="materialsUsed" className="text-sm font-medium text-gray-700">Materials Used</label>
                  <select
                    id="materialsUsed"
                    name="materialsUsed"
                    value={formData.materialsUsed}
                    onChange={handleChange}
                    className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                    disabled={!formData.vehicleType}
                  >
                    <option value="">Select Material</option>
                    {materialsOptions.map((material) => (
                      <option key={material} value={material}>{material}</option>
                    ))}
                  </select>
                </div>

                {/* Plan */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="plan" className="text-sm font-medium text-gray-700">Plan</label>
                  <select
                    id="plan"
                    name="plan"
                    value={formData.plan}
                    onChange={handleChange}
                    className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  >
                    <option value="">Select Plan</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>

                {/* Estimated Price */}
                {formData.vehicleType && formData.materialsUsed && formData.plan && (
                  <div className="text-green-700 font-semibold mt-2">
                    {estimatedPrice !== null
                      ? `Total Price: ${estimatedPrice.toFixed(2)}`
                      : <span className="text-red-600">Price unavailable for selected options</span>}
                  </div>
                )}

                {/* Ad Format */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="adFormat" className="text-sm font-medium text-gray-700">Ad Format</label>
                  <select
                    id="adFormat"
                    name="adFormat"
                    value={formData.adFormat}
                    onChange={handleChange}
                    className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#3674B5]"
                    required
                  >
                    <option value="">Select Format</option>
                    <option value="Image">Image</option>
                    <option value="Video">Video</option>
                  </select>
                </div>

                {/* Media Upload */}
                <div className="flex flex-col space-y-1">
                  <label htmlFor="media" className="text-sm font-medium text-gray-700">Media Upload</label>
                  <div className="w-full bg-gray-200 border border-gray-300 rounded-lg p-2 focus-within:ring-2 focus-within:ring-[#3674B5] focus:outline-none">
                    <input
                      id="media"
                      type="file"
                      name="media"
                      accept="image/*,video/*"
                      onChange={handleChange}
                      className="w-full"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateAdPopup(false)}
                    className="px-5 py-2 rounded-lg hover:bg-gray-200 border border-gray-300 text-gray-700"
                  >
                    Cancel
                  </button>
                  <Link to='/payment'>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-lg bg-[#3674B5] hover:bg-[#0E2A47] text-white font-semibold shadow hover:scale-105 transition-all duration-300"
                    >
                      Create Advertisement
                    </button>
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}
      </style>
    </div>
  );
};

export default Advertisements; 
