import { useState, useEffect, MouseEvent } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { Search, ChevronDown, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';
import { useMyAdsStatic } from '../../hooks/useMyAds';
import { CREATE_AD } from '../../graphql/admin/mutations/createAd';
import { DELETE_AD } from '../../graphql/user';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import { useToast, ToastContainer } from '../../components/ToastNotification';

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
  paymentStatus?: string | null;
  createdAt: string;
  startTime: string;
  endTime: string;
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

const statusFilterOptions = ['All Status', 'Pending', 'Approved', 'Rejected', 'Running'];

const Advertisements: React.FC = () => {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [searchTerm, setSearchTerm] = useState('');
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('All Plans');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adToDelete, setAdToDelete] = useState<string | null>(null);
  
  // ✅ OPTIMIZATION: Use shared hook (static variant - no polling needed)
  const { data, loading, error } = useMyAdsStatic();
  const [createAd] = useMutation(CREATE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
  });

  const [deleteAd, { loading: deleteLoading }] = useMutation(DELETE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
    onCompleted: () => {
      addToast({ 
        title: 'Success!', 
        message: 'Advertisement deleted successfully!', 
        type: 'success' 
      });
    },
    onError: (error) => {
      console.error('Error deleting ad:', error);
      addToast({ 
        title: 'Error!', 
        message: 'Failed to delete advertisement', 
        type: 'error' 
      });
    },
  });
  
  const ads: Ad[] = data?.getMyAds || [];
  
  // Debug payment status
  
  const formatDate = (dateValue: string | number) => {
    if (!dateValue) return 'N/A';
    
    try {
      let date: Date;
      
      if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
        date = new Date(parseInt(dateValue));
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      } else {
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

  const handleDeleteAd = (adId: string) => {
    setAdToDelete(adId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (adToDelete) {
      try {
        await deleteAd({ variables: { id: adToDelete } });
        setShowDeleteModal(false);
        setAdToDelete(null);
      } catch (error) {
        console.error('Error deleting ad:', error);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setAdToDelete(null);
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

  const parseAdDate = (dateString: string): Date => {
    if (/^\d+$/.test(dateString)) {
      return new Date(parseInt(dateString));
    }
    const parts = dateString.split(' ');
    const formattedDateString = `${parts[1]} ${parts[0]} ${parts[2]}`;
    return new Date(formattedDateString);
  };

  const isSameDay = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const isSameWeek = (d1: Date, d2: Date): boolean => {
    const startOfWeek1 = new Date(d1);
    startOfWeek1.setDate(d1.getDate() - d1.getDay());
    startOfWeek1.setHours(0, 0, 0, 0);

    const startOfWeek2 = new Date(d2);
    startOfWeek2.setDate(d2.getDate() - d2.getDay());
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

  const currentAds = filteredAds.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAds.length / itemsPerPage);

  const startItem = indexOfFirstItem + 1;
  const endItem = Math.min(indexOfLastItem, filteredAds.length);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handlePreviousPage = () => {
    handlePageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    handlePageChange(currentPage + 1);
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
    
    if (!formData.title.trim()) {
      addToast({ title: 'Error!', message: 'Please enter a title', type: 'error' });
      return;
    }
    if (!formData.description.trim()) {
      addToast({ title: 'Error!', message: 'Please enter a description', type: 'error' });
      return;
    }
    if (!formData.materialsUsed) {
      addToast({ title: 'Error!', message: 'Please select a material', type: 'error' });
      return;
    }
    if (!formData.plan) {
      addToast({ title: 'Error!', message: 'Please select a plan', type: 'error' });
      return;
    }
    if (!formData.adFormat) {
      addToast({ title: 'Error!', message: 'Please select an ad format', type: 'error' });
      return;
    }
    if (!formData.media) {
      addToast({ title: 'Error!', message: 'Please upload a media file', type: 'error' });
      return;
    }
    
    try {
      addToast({ 
        title: 'Error!', 
        message: 'Please use the "Create Advertisement" page for full functionality', 
        type: 'error' 
      });
      setShowCreateAdPopup(false);
    } catch (error) {
      console.error('Error creating ad:', error);
      addToast({ title: 'Error!', message: 'Failed to create ad', type: 'error' });
    }
  };

  const isMobile = window.innerWidth <= 640;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed blur-sm brightness-90"
        style={{
          backgroundImage: "url('/image/bg.jpg')",
        }}
      ></div>
      <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>
      <div className="relative min-h-screen bg-transparent lg:pl-64 px-4 sm:px-5 lg:pr-5 flex flex-col">
        <div className="bg-transparent w-full flex-1 flex flex-col">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 pt-16 lg:pt-10 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Advertisements</h1>
            <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 w-full lg:w-auto">
                <input
                  type="text"
                  className="text-xs text-black rounded-lg pl-5 py-3 w-full sm:w-80 shadow-md focus:outline-none bg-white/70"
                  placeholder="Search Advertisements"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="relative w-full sm:w-32">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
                  >
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
          <div className="flex justify-start lg:justify-end mb-6">
            <button
              onClick={() => navigate('/create-advertisement')}
              className="relative py-3 bg-gradient-to-r from-[#1B5087] to-[#3674B5] text-xs text-white w-full sm:w-40 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:scale-105 shadow-md"
              onMouseMove={(e: MouseEvent<HTMLButtonElement>) => {
                const button = e.currentTarget;
                const rect = button.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                button.style.setProperty('--x', `${x}px`);
                button.style.setProperty('--y', `${y}px`);
              }}
            >
              <span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(circle at var(--x, 20%) var(--y, 80%), rgba(255, 255, 255, 0.2) 0%, transparent 50%)',
                }}
              />
              <span className="relative z-10 flex items-center gap-2">
                <Plus size={16} />
                Add New Ads
              </span>
            </button>
          </div>

          <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {currentAds.length > 0 ? (
              currentAds.map((ad) => (
                <div
                  key={ad.id}
                  className="overflow-hidden shadow-md cursor-pointer relative flex flex-col bg-white/50 h-[395px] hover:scale-105 transition-transform duration-300"
                >
                  <div className="w-full h-44 flex-shrink-0 relative">
                    {ad.mediaFile ? (
                      ad.adFormat === "IMAGE" ? (
                        <img
                          src={ad.mediaFile}
                          alt={`${ad.title} image`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src =
                              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+";
                          }}
                        />
                      ) : ad.adFormat === "VIDEO" ? (
                        <video
                          className="w-full h-full object-cover"
                          controls
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const errorDiv = document.createElement("div");
                            errorDiv.className =
                              "w-full h-full bg-gray-500 flex items-center justify-center text-white";
                            errorDiv.innerHTML = "Video not available";
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
                      <div className="w-full h-full bg-gray-400 flex items-center justify-center text-black/70">
                        No Media
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-grow overflow-hidden">
                    {/* Upper content */}
                    <div
                      className="cursor-pointer flex flex-col flex-grow"
                      onClick={() => navigate(`/ad-details/${ad.id}`)}
                    >
                      <h3 className="text-xl font-semibold text-black/80 truncate">{ad.title}</h3>

                      <div className="text-sm text-[#1B5087] mb-2 font-medium">
                        {ad.startTime && ad.endTime ? (
                          formatDateRange(ad.startTime, ad.endTime)
                        ) : (
                          <span className="text-gray-400">Campaign dates not available</span>
                        )}
                      </div>

                      {/* Description */}
                      <div className="flex-grow overflow-y-auto max-h-24">
                        <p className="text-sm text-gray-600 break-words line-clamp-4">
                          {ad.description || "No description available"}
                        </p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="mt-3 pt-2 gap-3 flex items-center justify-start">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/ad-details/${ad.id}`);
                        }}
                        className="text-white px-3 py-2 bg-[#3674B5] rounded-full hover:bg-[#2a5a94] text-xs font-medium transition-all duration-300"
                      >
                        View Details
                      </button>

                      {ad.status === "APPROVED" && ad.paymentStatus === "PENDING" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/ad-details/${ad.id}`);
                          }}
                          className="text-xs px-3 py-2 rounded-full border border-gray-400 text-black shadow-sm hover:border-gray-700 transition-colors duration-200 cursor-pointer"
                        >
                          Proceed to Pay
                        </button>
                      )}
                    </div>
                  </div>


                  <div className="absolute top-2 left-2">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-semibold ${
                        ad.status === "PENDING"
                          ? "bg-yellow-200 text-yellow-800"
                          : ad.status === "APPROVED"
                          ? "bg-blue-200 text-blue-800"
                          : ad.status === "REJECTED"
                          ? "bg-red-200 text-red-800"
                          : ad.status === "RUNNING"
                          ? "bg-green-200 text-green-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {formatStatus(ad.status)}
                    </span>
                    
                    {ad.status === "REJECTED" && ad.reasonForReject && (
                      <div className="mt-1 text-xs text-red-600 bg-white/90 px-2 py-1 rounded shadow-sm backdrop-blur-sm">
                        {ad.reasonForReject}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center text-gray-500">
                No advertisements found for the selected filters.
              </div>
            )}
          </div>


          {/*Pagination*/}
          {filteredAds.length > 0 && (
            <div className="mt-auto flex justify-center py-4">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={handlePreviousPage}
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
                          onClick={() => handlePageChange(i)}
                          className={`px-2 sm:px-3 py-1 text-sm rounded ${
                            currentPage === i
                              ? "bg-[#3674B5] text-white"
                              : "text-gray-700 hover:border border-gray-300"
                          }`}
                        >
                          {i}
                        </button>
                      );
                    }

                    if (endPage < totalPages && !isMobile) {
                      pages.push(
                        <span key="ellipsis" className="px-2 text-gray-500">
                          …
                        </span>
                      );
                    }

                    return pages;
                  })()}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center px-2 sm:px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {showCreateAdPopup && (
          <div className="fixed inset-0 z-50 flex justify-end pr-2">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={() => setShowCreateAdPopup(false)}
            ></div>
            <div className="relative w-full max-w-xl h-[730px] pb-6 rounded-3xl bg-gray-200 mt-2 shadow-lg animate-slideIn">
              <div className="p-6 h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Create New Advertisement</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 mt-9">
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
                  {formData.vehicleType && formData.materialsUsed && formData.plan && (
                    <div className="text-green-700 font-semibold mt-2">
                      {estimatedPrice !== null
                        ? `Total Price: ${estimatedPrice.toFixed(2)}`
                        : <span className="text-red-600">Price unavailable for selected options</span>}
                    </div>
                  )}
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
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title="Delete Advertisement"
          message="Are you sure you want to delete this advertisement? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
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
    </div>
  );
};

export default Advertisements;