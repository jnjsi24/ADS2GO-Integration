import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ADS } from '../../graphql/user';
import { CREATE_AD } from '../../graphql/admin';

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

const Advertisements: React.FC = () => {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [planFilter, setPlanFilter] = useState('All Plans');
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
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
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

  // Helper function to parse ad date string
  const parseAdDate = (dateString: string): Date => {
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
    
    const matchesStatus = statusFilter === 'All Status' || 
      (statusFilter === 'Pending' && ad.status === 'PENDING') ||
      (statusFilter === 'Approved' && ad.status === 'APPROVED') ||
      (statusFilter === 'Rejected' && ad.status === 'REJECTED') ||
      (statusFilter === 'Running' && ad.status === 'RUNNING');
      
    const matchesPlan = planFilter === 'All Plans' || 
      (ad.planId?.name && ad.planId.name === planFilter);
    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  if (loading) return <div className="min-h-screen bg-gray-100 pl-64 pr-5 pt-10">Loading ads...</div>;
  if (error) return <div className="min-h-screen bg-gray-100 pl-64 pr-5 pt-10 text-red-600">Error loading ads: {error.message}</div>;
  const currentAds = filteredAds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAds.length / itemsPerPage);

  const startItem = indexOfFirstItem + 1;
  const endItem = Math.min(indexOfLastItem, filteredAds.length);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handlePlanFilterChange = (plan: string) => {
    setPlanFilter(plan);
    setCurrentPage(1);
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
    try {
      const { data } = await createAd({
        variables: {
          input: {
            title: formData.title.trim(),
            description: formData.description.trim(),
            vehicleType: formData.vehicleType,
            materialId: formData.materialsUsed,
            planId: formData.plan,
            adFormat: formData.adFormat,
            status: formData.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING',
            price: 0, // This should be calculated based on the plan and material
          },
        },
      });
      
      if (data?.createAd) {
        setShowCreateAdPopup(false);
        setFormData({
          title: '',
          description: '',
          vehicleType: '',
          materialsUsed: '',
          adFormat: '',
          plan: '',
          media: null,
          status: 'PENDING',
        });
        setToasts((prev: Toast[]) => [...prev, { 
          id: Date.now(), 
          message: 'Ad created successfully!', 
          type: 'success' as const 
        }]);
      }
    } catch (error) {
      console.error('Error creating ad:', error);
      setToasts((prev: Toast[]) => [...prev, { id: Date.now(), message: 'Failed to create ad', type: 'error' }]);
    }
  };

  return (
    <div className="min-h-screen rounded-l-xl bg-white pl-64 pr-5">
      <div className="bg-white p-6 flex justify-between items-center">
        <h1 className="text-4xl mt-8 font-semibold">Advertisements</h1>
        <div className="flex space-x-3">
          <span className="pt-1 mt-10 text-gray-500 ">{filteredAds.length} Ads found</span>
          <button
            onClick={() => navigate('/create-advertisement')}
            className="px-4 py-2 bg-[#FADA7A] mt-10 text-gray-600 text-sm font-semibold w-32 rounded-2xl hover:bg-[#F5F0CD] hover:scale-105 transition-all duration-300"
          >
            Add New Ads
          </button>
        </div>
      </div>

        {/* Filters */}
        <div className="p-6 flex space-x-4">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs text-black rounded-3xl pl-5 pr-10 py-3 shadow-md border border-black focus:outline-none appearance-none bg-gray-100"
            >
              <option value="All Status">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Dispatch">Dispatch</option>
              <option value="Completed">Completed</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-xs text-black rounded-3xl pl-5 pr-10 py-3 shadow-md border border-black focus:outline-none appearance-none bg-gray-100"
            >
              <option value="All Plans">All Plans</option>
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        <div className="relative w-96">
          <input
            type="text"
            placeholder="Search Ads"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs text-black rounded-xl pl-10 py-3 w-full shadow-md border border-black focus:outline-none appearance-none bg-white"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        </div>
      

      {/* Ad Cards */}
      <div className=" bg-none p-6 grid grid-cols-4 gap-6">
        {currentAds.length > 0 ? (
          currentAds.map((ad) => (
            <div
              key={ad.id}
              className=" overflow-hidden relative flex flex-col h-full hover:scale-105 transition-all duration-300"
            >
              <div className="w-full h-48 flex-shrink-0 rounded-lg relative bg-gray-300">
                {ad.adFormat === 'Video' && ad.mediaFile ? (
                  <video
                    src={ad.mediaFile}
                    className="w-full h-full object-cover rounded-lg"
                    controls
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : ad.mediaFile ? (
                  <img
                    src={ad.mediaFile}
                    alt={`${ad.title} image`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-300 flex items-center justify-center text-white">
                    {/* Placeholder div to match the image */}
                  </div>
                )}
              </div>

              <div className="p-4 bg-none flex-grow flex flex-col">
                <div className="flex-grow cursor-pointer" onClick={() => navigate(`/ad-details/${ad.id}`)}>
                  <h3 className="text-2xl font-semibold text-black">{ad.title}</h3>
                  <p className="text-md text-gray-600">{ad.planId?.name} Plan</p>
                  <p className="text-sm text-gray-500 mt-2 overflow-hidden whitespace-nowrap text-ellipsis">{ad.description}</p>
                </div>

                <div className="mt-4 pt-5 border-t border-gray-200 flex space-x-2">
                  <span className={`px-4 py-2 text-sm font-semibold rounded-xl text-black ${
                      ad.status === 'PENDING' ? 'bg-yellow-200' : 
                      ad.status === 'APPROVED' ? 'bg-blue-200' :
                      ad.status === 'REJECTED' ? 'bg-red-200' :
                      ad.status === 'RUNNING' ? 'bg-green-200' :
                      'bg-gray-200'}`}>
                    {formatStatus(ad.status)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/ad-details/${ad.id}`);
                    }}
                    className="text-black text-sm bg-none border font-semibold rounded-xl px-4 py-2 flex items-center justify-center flex-grow hover:bg-[#1B5087] hover:text-white transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
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
                      ? `Total Price: $${estimatedPrice.toFixed(2)}`
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