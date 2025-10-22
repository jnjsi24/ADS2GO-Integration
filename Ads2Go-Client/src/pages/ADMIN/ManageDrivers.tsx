import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useLocation } from 'react-router-dom';
import { X, Trash, Eye, ChevronLeft, ChevronDown, Car, Bike, User, IdCard, CalendarClock, Mail, CalendarCheck2, Phone, MapPin, Check, CheckCircle, AlertCircle, XCircle, ChevronRight } from 'lucide-react';
import { GET_ALL_DRIVERS, GET_DRIVER_USAGE_HISTORY } from '../../graphql/admin/queries/manageDrivers';
import { GET_ALL_MATERIALS } from '../../graphql/admin/queries/materials';
import { GET_DRIVER_MATERIALS } from '../../graphql/admin/queries/driverMaterials';
import { APPROVE_MONTHLY_PHOTO, REJECT_MONTHLY_PHOTO } from '../../graphql/admin/mutations/compliance';
import { APPROVE_DRIVER, REJECT_DRIVER, DELETE_DRIVER } from '../../graphql/admin/mutations/manageDrivers';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import { AdminLoader } from "../../components/ProtectedRoute";
import { ToastContainer } from '../../components/ToastNotification';

// === Types ===
interface Driver {
  id: string;
  driverId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  contactNumber: string;
  vehicleType: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  accountStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'RESUBMITTED';
  reviewStatus: string;
  installedMaterialType?: string;
  address?: string;
  licenseNumber?: string;
  licensePictureURL?: string;
  orCrPictureURL?: string;
  vehiclePhotoURL?: string;
  profilePicture?: string;
  dateJoined: string;
  approvalDate?: string;
  rejectedReason?: string;
  createdAt: string;
  lastLogin?: string;
  material?: {
    materialId: string;
    materialType: string;
    category: string;
    description?: string;
  };
}

// === Helper ===
const getInitials = (firstName: string, lastName: string) =>
  `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

const getImageUrl = (imagePath: string | undefined | null) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  if (imagePath.startsWith('/uploads')) {
    return `${process.env.REACT_APP_SERVER_URL || 'http://localhost:4000'}${imagePath}`;
  }
  return imagePath;
};

// Profile Picture Component
const ProfilePicture: React.FC<{ 
  driver: Driver; 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isMobile: boolean; // Added isMobile prop
}> = ({ driver, size = 'sm', className = '', isMobile }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(driver.profilePicture);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: isMobile ? 'w-12 h-12 text-xl' : 'w-16 h-16 text-2xl'
  };

  if (imageUrl && !imageError) {
    return (
      <img
        src={imageUrl}
        alt={`${driver.firstName} ${driver.lastName}`}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center font-semibold text-white rounded-full bg-[#FF9D3D] ${className}`}>
      {getInitials(driver.firstName, driver.lastName)}
    </div>
  );
};

// Document Image Component
const DocumentImage: React.FC<{
  src: string | undefined | null;
  alt: string;
  title: string;
  className?: string;
  setShowImageModal: (show: boolean) => void;
  setModalImageSrc: (src: string) => void;
}> = ({ src, alt, title, className = '', setShowImageModal, setModalImageSrc }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(src);

  if (!imageUrl || imageError) {
    return (
      <div className={`${className} bg-gray-200 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center`}>
        <User size={32} className="text-gray-400 mb-2" />
        <p className="text-sm text-gray-500 text-center">No {title} available</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      <p className="font-medium mb-2">{title}</p>
      <img 
        src={imageUrl}
        alt={alt}
        className={`${className} border rounded-lg cursor-pointer hover:opacity-90 transition-opacity`}
        onError={() => setImageError(true)}
      />
      <button 
        className="absolute inset-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center"
        onClick={() => {
          setModalImageSrc(imageUrl); 
          setShowImageModal(true);
        }}
      >
        <span className="absolute top-10 left-2 text-black bg-gray-200 w-40 h-6 flex items-center justify-center rounded-md text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Click to view image
        </span>
      </button>
    </div>
  );
};

const statusFilterOptions = ['All Status', 'Active', 'Pending', 'Rejected'];
const monthOptions = [
  'All Months', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = ['All Years'];
  for (let i = 0; i < 6; i++) {
    years.push((currentYear - i).toString());
  }
  return years;
};
const yearOptions = generateYearOptions();

const ManageDrivers: React.FC = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [driverToReject, setDriverToReject] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check URL parameters for status filter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const statusParam = urlParams.get('status');
    if (statusParam === 'pending') {
      setSelectedStatusFilter('Pending');
    }
  }, [location.search]);

  // Toast notification state
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
  }>>([]);

  const addToast = (toast: Omit<typeof toasts[0], 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => removeToast(id), toast.duration || 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const { data, loading, error, refetch } = useQuery(GET_ALL_DRIVERS, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const { data: driverMaterialsData, refetch: refetchDriverMaterials } = useQuery(GET_DRIVER_MATERIALS, {
    variables: { driverId: selectedDriverDetails?.driverId || '' },
    skip: !selectedDriverDetails?.driverId,
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  // Fetch all materials to compute live availability counts by type for the selected driver's vehicle
  const { data: materialsInventoryData } = useQuery(GET_ALL_MATERIALS, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const { data: driverUsageData, refetch: refetchDriverUsage } = useQuery(GET_DRIVER_USAGE_HISTORY, {
    variables: { driverId: selectedDriverDetails?.driverId || '' },
    skip: !selectedDriverDetails?.driverId,
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const [approveDriver] = useMutation(APPROVE_DRIVER, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const [rejectDriver] = useMutation(REJECT_DRIVER, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const [deleteDriver] = useMutation(DELETE_DRIVER, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const [approveMonthlyPhoto] = useMutation(APPROVE_MONTHLY_PHOTO, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });
  const [rejectMonthlyPhoto] = useMutation(REJECT_MONTHLY_PHOTO, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const drivers: Driver[] = data?.getAllDrivers || [];

  const filteredDrivers = drivers.filter((r: Driver) => {
    const fullName = `${r.firstName} ${r.middleName || ''} ${r.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                         r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.contactNumber.includes(searchTerm) ||
                         r.driverId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'All Status' || r.accountStatus.toLowerCase() === selectedStatusFilter.toLowerCase();
    let matchesDate = true;
    if (selectedMonth !== 'All Months' || selectedYear !== 'All Years') {
      const createdAt = new Date(r.createdAt);
      const driverMonth = createdAt.toLocaleString('default', { month: 'long' });
      const driverYear = createdAt.getFullYear().toString();
      const matchesMonth = selectedMonth === 'All Months' || driverMonth === selectedMonth;
      const matchesYear = selectedYear === 'All Years' || driverYear === selectedYear;
      matchesDate = matchesMonth && matchesYear;
    }
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleApprove = async (driverId: string) => {
    try {
      const result = await approveDriver({ variables: { driverId, materialTypeOverride: null } });
      if (result.data?.approveDriver?.success) {
        addToast({
          type: 'success', title: 'Success!', message: 'Driver has been accepted successfully.', duration: 4000
        });
        refetch();
      } else {
        addToast({
          type: 'error', title: 'Approval Failed', message: result.data?.approveDriver?.message || 'Failed to approve driver', duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error approving driver:', error);
      addToast({
        type: 'error', title: 'Approval Failed', message: error.message || 'Failed to approve driver', duration: 6000
      });
    }
  };

  const handleConfirmApproveWithMaterials = async () => {
    if (!selectedDriverDetails) return;
    try {
      const override = selectedMaterials.length > 0 ? selectedMaterials : null;
      const result = await approveDriver({ variables: { driverId: selectedDriverDetails.driverId, materialTypeOverride: override } });
      if (result.data?.approveDriver?.success) {
        addToast({
          type: 'success', title: 'Success!', message: 'Driver has been accepted successfully.', duration: 4000
        });
        setShowMaterialModal(false);
        setShowDetailsModal(false);
        setSelectedMaterials([]);
        refetch();
      } else {
        addToast({
          type: 'error', title: 'Approval Failed', message: result.data?.approveDriver?.message || 'Failed to approve driver', duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error approving driver with materials:', error);
      addToast({
        type: 'error', title: 'Approval Failed', message: error.message || 'Failed to approve driver', duration: 6000
      });
    }
  };

  // Open approval modal to choose material types and see availability
  const openApprovalWithMaterialSelection = (driver: Driver) => {
    setSelectedDriverDetails(driver);
    setSelectedMaterials([]);
    setShowMaterialModal(true);
  };

  const handleReject = (driverId: string) => {
    setDriverToReject(driverId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!driverToReject || !rejectReason.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide a reason for rejection',
        duration: 4000
      });
      return;
    }
    try {
      const result = await rejectDriver({ variables: { driverId: driverToReject, reason: rejectReason.trim() } });
      if (result.data?.rejectDriver?.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: 'Driver has been rejected.',
          duration: 4000
        });
        refetch();
        setShowRejectModal(false);
        setRejectReason('');
        setDriverToReject(null);
      } else {
        addToast({
          type: 'error',
          title: 'Rejection Failed',
          message: result.data?.rejectDriver?.message || 'Failed to reject driver',
          duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error rejecting driver:', error);
      let errorMessage = 'Failed to reject driver';
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.networkError) {
        errorMessage = `Network Error: ${error.networkError.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      addToast({
        type: 'error',
        title: 'Rejection Failed',
        message: errorMessage,
        duration: 6000
      });
    }
  };

  const handleDelete = (driverId: string) => {
    setDriverToDelete(driverId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (driverToDelete) {
      try {
        const result = await deleteDriver({ variables: { driverId: driverToDelete } });
        if (result.data?.deleteDriver?.success) {
          addToast({
            type: 'success',
            title: 'Success!',
            message: 'Driver has been deleted successfully.',
            duration: 4000
          });
          refetch();
        } else {
          addToast({
            type: 'error',
            title: 'Deletion Failed',
            message: result.data?.deleteDriver?.message || 'Failed to delete driver',
            duration: 6000
          });
        }
        setShowDeleteModal(false);
        setDriverToDelete(null);
      } catch (error: any) {
        console.error('Error deleting driver:', error);
        addToast({
          type: 'error',
          title: 'Deletion Failed',
          message: error.message || 'Failed to delete driver',
          duration: 6000
        });
        setShowDeleteModal(false);
        setDriverToDelete(null);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDriverToDelete(null);
  };

  const handleViewDetails = (driver: Driver) => {
    setSelectedDriverDetails(driver);
    setCurrentImageIndex(0);
    setShowDetailsModal(true);
    setTimeout(() => setIsModalOpen(true), 10);
    // Load driver materials & compliance
    setTimeout(() => {
      refetchDriverMaterials && refetchDriverMaterials();
      refetchDriverUsage && refetchDriverUsage();
    }, 0);
    if (driver.accountStatus === 'REJECTED') {
      setShowRejectionNotification(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setShowDetailsModal(false);
      setSelectedDriverDetails(null);
    }, 300);
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDrivers(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPageDriverIds = paginatedDrivers.map(driver => driver.driverId);
    const allCurrentPageSelected = currentPageDriverIds.every(id => selectedDrivers.includes(id));
    if (allCurrentPageSelected) {
      setSelectedDrivers(prev => prev.filter(id => !currentPageDriverIds.includes(id)));
    } else {
      setSelectedDrivers(prev => {
        const newSelection = [...prev];
        currentPageDriverIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDrivers = filteredDrivers.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatusFilter, selectedMonth, selectedYear]);

  const isAllSelected = paginatedDrivers.length > 0 && paginatedDrivers.every(driver => selectedDrivers.includes(driver.driverId));

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  return (
    <div
    className={`min-h-screen bg-gray-100 p-4 md:p-10 flex flex-col ${
      isMobile ? 'px-10 pl-28' : 'ml-60'
    }`}
  >
      {/* Mobile Header */}
      {isMobile && (
        <div className="flex items-center mb-4">
          <h1 className="text-xl pt-7 font-bold text-gray-800">Drivers Management</h1>
        </div>
      )}

      {/* Header with Title and Filters */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        {!isMobile && (
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Drivers Management</h1>
        )}
        <div className="flex flex-col sm:flex-row gap-1 w-full lg:w-auto">
          <div className="w-full lg:w-80">
            <input
              type="text"
              placeholder="Search by name or Driver ID..."
              className="w-full text-xs text-black rounded-md pl-4 py-3 shadow-md focus:outline-none bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            <div className="relative flex-1 sm:flex-none sm:w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedStatusFilter}</span>
                <ChevronDown size={16} className={`flex-shrink-0 transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showStatusDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    {statusFilterOptions.map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusFilterChange(status)}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {status}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative flex-1 sm:flex-none sm:w-32">
              <button
                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedMonth}</span>
                <ChevronDown size={16} className={`flex-shrink-0 transform transition-transform duration-200 ${showMonthDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showMonthDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {monthOptions.map(month => (
                      <button
                        key={month}
                        onClick={() => { setSelectedMonth(month); setShowMonthDropdown(false); }}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {month}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="relative flex-1 sm:flex-none sm:w-32">
              <button
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedYear}</span>
                <ChevronDown size={16} className={`flex-shrink-0 transform transition-transform duration-200 ${showYearDropdown ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showYearDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    {yearOptions.map(year => (
                      <button
                        key={year}
                        onClick={() => { setSelectedYear(year); setShowYearDropdown(false); }}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {year}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Driver List */}
      {loading ? (
        <AdminLoader />
      ) : error ? (
        <div className="text-center py-10 text-red-500">Error: {error.message}</div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm ? 'No drivers match your search criteria' : 'No drivers found'}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="rounded-xl mb-4 overflow-hidden flex-1">
            {!isMobile && (
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-black">
                <div className="flex items-center gap-2 col-span-3">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    onChange={() => {}}
                    onClick={handleSelectAll}
                    checked={isAllSelected}
                  />
                  <span className="cursor-pointer" onClick={handleSelectAll}>Name</span>
                </div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Contact</div>
                <div className="col-span-1">Vehicle</div>
                <div className="col-span-1 flex items-center gap-1">
                  <span>Status</span>
                </div>
                <div className="col-span-2 text-center">Action</div>
              </div>
            )}

            {paginatedDrivers.map((driver: Driver) => (
              <div
                key={driver.driverId}
                className="bg-white mb-3 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
                onClick={() => handleViewDetails(driver)}
              >
                {isMobile ? (
                  <div className="p-4 cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={selectedDrivers.includes(driver.driverId)}
                          onChange={() => {}}
                          onClick={(e) => handleSelect(driver.driverId, e)}
                        />
                        <ProfilePicture driver={driver} className="w-10 h-10" isMobile={isMobile} />
                        <div>
                          <div className="font-semibold text-gray-800">
                            {driver.firstName} {driver.lastName}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">
                            {driver.email}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-black mb-3">
                      <div>
                        <div className="font-medium">Vehicle</div>
                        <div className="truncate">{driver.vehicleType}</div>
                      </div>
                      <div>
                        <div className="font-medium">Contact</div>
                        <div>{driver.contactNumber}</div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          driver.accountStatus === 'ACTIVE' ? 'bg-green-200 text-green-800' :
                          driver.accountStatus === 'PENDING' ? 'bg-yellow-200 text-yellow-800' :
                          driver.accountStatus === 'REJECTED' ? 'bg-red-200 text-red-800' :
                          'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {driver.accountStatus}
                      </span>
                      {driver.accountStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openApprovalWithMaterialSelection(driver); }}
                            className="flex items-center bg-green-200 text-green-700 px-3 py-1 rounded border border-green-200 hover:bg-green-50"
                          >
                            <Check size={14} className="mr-1" />
                            <span className="text-xs">Accept</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(driver.driverId); }}
                            className="flex items-center bg-red-200 text-red-700 px-3 py-1 rounded border border-red-200 hover:bg-red-50"
                          >
                            <X size={14} className="mr-1" />
                            <span className="text-xs">Reject</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(driver.driverId); }}
                        className="flex items-center text-red-700 px-1 py-1 rounded shadow-md hover:bg-red-50"
                      >
                        <Trash size={14}/>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm transition-colors cursor-pointer rounded-lg">
                    <div className="col-span-3 gap-3 flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={selectedDrivers.includes(driver.driverId)}
                        onChange={() => {}}
                        onClick={(e) => handleSelect(driver.driverId, e)}
                      />
                      <div className="flex items-center">
                        <ProfilePicture driver={driver} className="mr-3" isMobile={isMobile} />
                        <span className="truncate font-semibold">
                          {`${driver.firstName} ${driver.middleName || ''} ${driver.lastName}`}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3 truncate">{driver.email}</div>
                    <div className="col-span-2 truncate">{driver.contactNumber}</div>
                    <div className="col-span-1 truncate">{driver.vehicleType}</div>
                    <div className="col-span-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          driver.accountStatus === 'ACTIVE' ? 'bg-green-200 text-green-800' :
                          driver.accountStatus === 'PENDING' ? 'bg-yellow-200 text-yellow-800' :
                          driver.accountStatus === 'REJECTED' ? 'bg-red-200 text-red-800' :
                          'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {driver.accountStatus}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {driver.accountStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => openApprovalWithMaterialSelection(driver)}
                            className="group flex items-center text-green-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                          >
                            <Check className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300" size={16} />
                            <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                              Accept
                            </span>
                          </button>
                          <button
                            onClick={() => handleReject(driver.driverId)}
                            className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                          >
                            <X className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300" size={16} />
                            <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                              Reject
                            </span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(driver.driverId)}
                        className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                      >
                        <Trash className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300" size={16} />
                        <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                          Delete
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Material Selection Modal */}
      {showMaterialModal && selectedDriverDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Select Material Type(s)</h2>
              <button
                onClick={() => { setShowMaterialModal(false); setSelectedMaterials([]); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Choose one or more materials to approve for this driver. If you leave it empty, the current server default will be used.</p>
            <div className="grid grid-cols-1 gap-2 mb-4">
              {(() => {
                // Derive available material types and counts for this driver's vehicle type
                const allMats = materialsInventoryData?.getAllMaterials || [];
                const vehicleType = selectedDriverDetails?.vehicleType;
                const filtered = vehicleType ? allMats.filter((m: any) => m.vehicleType === vehicleType && !m.driverId) : [];
                const counts: Record<string, number> = {};
                filtered.forEach((m: any) => { counts[m.materialType] = (counts[m.materialType] || 0) + 1; });
                const types = Object.keys(counts).sort();
                if (types.length === 0) {
                  return <p className="text-sm text-red-600">No available materials for this driver’s vehicle type.</p>;
                }
                return types.map((mType) => (
                  <label key={mType} className="flex items-center justify-between text-sm px-3 py-2 border rounded-md">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.includes(mType)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedMaterials(prev => checked ? [...prev, mType] : prev.filter(x => x !== mType));
                        }}
                      />
                      <span className="font-medium">{mType}</span>
                    </span>
                    <span className="text-xs text-gray-600">{counts[mType]} available</span>
                  </label>
                ));
              })()}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => { setShowMaterialModal(false); setSelectedMaterials([]); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={handleConfirmApproveWithMaterials}
              >
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDriverDetails && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black bg-opacity-50" onClick={handleCloseModal}>
          <div
            className={`fixed ${
              isMobile ? 'inset-x-4 top-16 bottom-6 w-auto max-h-[80vh] rounded-md' : 'top-2 bottom-2 right-2 w-full max-w-xl rounded-lg'
            } bg-white shadow-xl transform transition-all duration-300 ease-in-out ${
              isModalOpen ? (isMobile ? 'scale-100 opacity-100' : 'translate-x-0 opacity-100') : (isMobile ? 'scale-95 opacity-0' : 'translate-x-full opacity-0')
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`h-full ${isMobile ? 'p-4' : 'p-6'} overflow-y-auto`}>
              {isMobile && (
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Driver Details</h2>
                  <button onClick={handleCloseModal} className="p-1 rounded-full hover:bg-gray-200">
                    <X size={20} />
                  </button>
                </div>
              )}
              <div className="flex items-center mb-6">
                <ProfilePicture driver={selectedDriverDetails} size="lg" className="mr-4 shadow-md" isMobile={isMobile} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-gray-800 truncate`}>
                      {`${selectedDriverDetails.firstName} ${selectedDriverDetails.middleName || ""} ${selectedDriverDetails.lastName}`}
                    </h2>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        selectedDriverDetails.accountStatus === 'ACTIVE' ? 'bg-green-200 text-green-800' :
                        selectedDriverDetails.accountStatus === 'PENDING' ? 'bg-yellow-200 text-yellow-800' :
                        selectedDriverDetails.accountStatus === 'REJECTED' ? 'bg-red-200 text-red-800' :
                        'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {selectedDriverDetails.accountStatus}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{selectedDriverDetails.driverId}</p>
                </div>
              </div>
              <div className="mb-6">
                <div
                  className={`grid ${
                    isMobile ? "grid-cols-2 gap-4" : "grid-cols-1 md:grid-cols-5 gap-6"
                  }`}
                >
                  {/* Left Side (Vehicle Info) */}
                  <div
                    className={`flex flex-col items-center justify-center h-full ${
                      isMobile ? "text-center" : "md:col-span-2 pb-16"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center">
                      {selectedDriverDetails.vehicleType?.toLowerCase() === "car" ? (
                        <Car className={`${isMobile ? "w-10 h-10 mb-2" : "w-20 h-20 mb-3"} text-gray-700`} />
                      ) : (
                        <Bike className={`${isMobile ? "w-8 h-8 mb-2" : "w-12 h-12 mb-3"} text-gray-700`} />
                      )}
                      <p className="text-sm sm:text-base font-bold text-gray-600">
                        {selectedDriverDetails.vehiclePlateNumber}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-900">
                        {selectedDriverDetails.vehicleModel}
                      </p>
                    </div>
                  </div>

                  {/* Right Side (Material Info) */}
                  <div
                    className={`flex flex-col justify-between h-full ${
                      isMobile ? "items-start" : "p-6 md:col-span-3"
                    }`}
                  >
                    <div className={`${isMobile ? "mb-2" : "mb-4"}`}>
                      <p className="text-xs sm:text-sm text-gray-500">Assigned Material</p>
                      <p className="text-gray-900 font-bold text-sm sm:text-base">
                        {selectedDriverDetails.material?.materialId ||
                          selectedDriverDetails.material?.materialType ||
                          selectedDriverDetails.material?.description ||
                          selectedDriverDetails.installedMaterialType ||
                          "N/A"}
                      </p>
                    </div>

                    <div className={`${isMobile ? "mb-2" : "mb-4"}`}>
                      <p className="text-xs sm:text-sm text-gray-500">Assigned Date</p>
                      <p className="text-gray-900 font-bold text-sm sm:text-base">
                        {(() => {
                          const materials = driverMaterialsData?.getDriverMaterials?.materials || [];
                          if (!materials.length) return "N/A";
                          const targetMaterialId = selectedDriverDetails?.material?.materialId || "";
                          const m = targetMaterialId
                            ? (materials.find((x: any) => x.materialId === targetMaterialId) || materials[0])
                            : materials[0];
                          const dateStr = m?.assignedDate || m?.mountedAt;
                          return dateStr
                            ? new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                            : "N/A";
                        })()}
                      </p>
                    </div>

                    <div className={`${isMobile ? "mb-2" : "mb-4"}`}>
                      <p className="text-xs sm:text-sm text-gray-500">Driver Created</p>
                      <p className="text-gray-900 font-bold text-sm sm:text-base">
                        {formatDate(selectedDriverDetails.createdAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Preferred Material</p>
                      <p className="text-gray-900 font-bold text-sm sm:text-base">
                        {selectedDriverDetails.material?.materialType ||
                          selectedDriverDetails.installedMaterialType ||
                          "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3">Driver Details:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <IdCard size={16} />
                      <span className="font-semibold text-gray-700">{selectedDriverDetails.licenseNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail size={16} />
                      <span className="font-semibold text-gray-700">{selectedDriverDetails.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <CalendarClock size={16} />
                      <span className="font-semibold text-gray-700">{formatDate(selectedDriverDetails.createdAt)}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                      <p className="break-words font-semibold text-gray-700">{selectedDriverDetails.address || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <CalendarCheck2 size={16} />
                      <span className="font-semibold text-gray-700">{formatDate(selectedDriverDetails.lastLogin)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={16} />
                      <span className="font-semibold text-gray-700">{selectedDriverDetails.contactNumber}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Material History */}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3">Material History</h3>
                {(() => {
                  const history = driverUsageData?.getDriverUsageHistory?.usageHistory || [];
                  if (!history.length) return <p className="text-sm text-gray-500">No material history found for this driver.</p>;
                  return (
                    <div className="space-y-2">
                      {history.map((h: any) => (
                        <div key={h.id} className="border rounded p-3 bg-gray-50 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-gray-200">{h.materialStringId || h.materialId}</span>
                            {h.isActive ? (
                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">ACTIVE</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-gray-200">ENDED</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-700">
                            <div>
                              Assigned: {h.assignedAt ? new Date(h.assignedAt).toLocaleString() : 'N/A'}
                              {h.unassignedAt && <span> → {new Date(h.unassignedAt).toLocaleString()}</span>}
                            </div>
                            <div>
                              Mounted: {h.mountedAt ? new Date(h.mountedAt).toLocaleString() : 'N/A'}
                              {h.dismountedAt && <span> • Dismounted: {new Date(h.dismountedAt).toLocaleString()}</span>}
                            </div>
                            {/* Reason removed per request */}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {/* Monthly Compliance */}
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-3">Monthly Compliance</h3>
                {(() => {
                  const materials = driverMaterialsData?.getDriverMaterials?.materials || [];
                  if (!materials.length) {
                    return <p className="text-sm text-gray-500">No assigned materials found for this driver.</p>;
                  }
                  // Prefer the driver's assigned materialId if available
                  const targetMaterialId = selectedDriverDetails?.material?.materialId || '';
                  const material = targetMaterialId ? (materials.find((m: any) => m.materialId === targetMaterialId) || materials[0]) : materials[0];
                  const tracking = material.materialTracking;
                  const photos = tracking?.monthlyPhotos || [];
                  // Derive last/next dates if backend fields are missing
                  const derivedLast = (() => {
                    if (tracking?.lastPhotoUpload) return new Date(tracking.lastPhotoUpload);
                    if (!photos.length) return null;
                    const latest = photos
                      .map((p: any) => (p.uploadedAt ? new Date(p.uploadedAt).getTime() : 0))
                      .reduce((a: number, b: number) => Math.max(a, b), 0);
                    return latest ? new Date(latest) : null;
                  })();
                  const derivedNext = (() => {
                    if (tracking?.nextPhotoDue) return new Date(tracking.nextPhotoDue);
                    // If no last upload yet, schedule first due 1 month after assigned/mounted
                    if (!derivedLast) {
                      const base = material.assignedDate || material.mountedAt;
                      if (base) {
                        const d = new Date(base);
                        if (!isNaN(d.getTime())) {
                          d.setMonth(d.getMonth() + 1);
                          return d;
                        }
                      }
                      return null;
                    }
                    const d = new Date(derivedLast);
                    d.setMonth(d.getMonth() + 1);
                    return d;
                  })();
                  return (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
                        <span className="px-2 py-0.5 rounded-full bg-gray-200">Material: {material.materialId}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-200">Status: {tracking?.photoComplianceStatus || 'PENDING'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-200">Last: {derivedLast ? derivedLast.toLocaleDateString() : 'N/A'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-200">Next Due: {derivedNext ? derivedNext.toLocaleDateString() : 'N/A'}</span>
                      </div>
                      {photos.length === 0 ? (
                        <p className="text-sm text-gray-500">No monthly photos uploaded yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {photos.map((p: any, idx: number) => (
                            <div key={`${p.month}-${idx}`} className="bg-white border rounded p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold">{p.month}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'APPROVED' ? 'bg-green-100 text-green-700' : p.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                                  <span className="text-xs text-gray-500">{p.uploadedAt ? new Date(p.uploadedAt).toLocaleString() : ''}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                    onClick={async () => {
                                      try {
                                        // Prompt for condition status when approving
                                        const condition = window.prompt('Set material condition for this inspection (EXCELLENT, GOOD, FAIR, POOR, DAMAGED):', 'GOOD') || undefined;
                                        const res = await approveMonthlyPhoto({ variables: { materialId: material.id, month: p.month, adminNotes: '', condition } });
                                        if (res.data?.approveMonthlyPhoto?.success) {
                                          addToast({ type: 'success', title: 'Approved', message: 'Photo approved', duration: 3000 });
                                          refetchDriverMaterials && refetchDriverMaterials();
                                        } else {
                                          addToast({ type: 'error', title: 'Failed', message: res.data?.approveMonthlyPhoto?.message || 'Approve failed' });
                                        }
                                      } catch (e: any) {
                                        addToast({ type: 'error', title: 'Failed', message: e.message || 'Approve failed' });
                                      }
                                    }}
                                  >Approve</button>
                                  <button
                                    className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    onClick={async () => {
                                      try {
                                        const res = await rejectMonthlyPhoto({ variables: { materialId: material.id, month: p.month, adminNotes: '' } });
                                        if (res.data?.rejectMonthlyPhoto?.success) {
                                          addToast({ type: 'success', title: 'Rejected', message: 'Photo rejected', duration: 3000 });
                                          refetchDriverMaterials && refetchDriverMaterials();
                                        } else {
                                          addToast({ type: 'error', title: 'Failed', message: res.data?.rejectMonthlyPhoto?.message || 'Reject failed' });
                                        }
                                      } catch (e: any) {
                                        addToast({ type: 'error', title: 'Failed', message: e.message || 'Reject failed' });
                                      }
                                    }}
                                  >Reject</button>
                                </div>
                              </div>
                              {Array.isArray(p.photoUrls) && p.photoUrls.length > 0 && (
                                <div className="mt-2 flex gap-2 flex-wrap">
                                  {p.photoUrls.map((u: string, i: number) => (
                                    <img key={i} src={u} alt={`photo-${i}`} className="w-24 h-24 object-cover rounded border" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder-image.png'; }} />
                                  ))}
                                </div>
                              )}
                              {p.adminNotes && <p className="text-xs text-gray-500 mt-1">Notes: {p.adminNotes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3 text-center">Documents & Photos</h3>
                {(() => {
                  const documents = [
                    { src: selectedDriverDetails.profilePicture, title: 'Profile Picture' },
                    { src: selectedDriverDetails.licensePictureURL, title: 'Driver License' },
                    { src: selectedDriverDetails.orCrPictureURL, title: 'OR/CR Document' },
                    { src: selectedDriverDetails.vehiclePhotoURL, title: 'Vehicle Photo' }
                  ].filter(doc => doc.src);
                  if (documents.length === 0) {
                    return <p className="text-center text-gray-500">No documents or photos available.</p>;
                  }
                  return (
                    <div className="relative">
                      <button
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 text-black p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity z-10"
                        onClick={() => setCurrentImageIndex(prevIndex => prevIndex === 0 ? documents.length - 1 : prevIndex - 1)}
                        aria-label="Previous image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                      <button
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 text-black p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity z-10"
                        onClick={() => setCurrentImageIndex(prevIndex => prevIndex === documents.length - 1 ? 0 : prevIndex + 1)}
                        aria-label="Next image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                      <DocumentImage
                        key={documents[currentImageIndex].title}
                        src={documents[currentImageIndex].src}
                        alt={documents[currentImageIndex].title}
                        title={documents[currentImageIndex].title}
                        className="w-full h-60 object-contain"
                        setShowImageModal={setShowImageModal}
                        setModalImageSrc={setModalImageSrc}
                      />
                      <p className="text-center text-sm text-gray-500 mt-2">
                        {documents[currentImageIndex].title} ({currentImageIndex + 1} of {documents.length})
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredDrivers.length > 0 && (
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

      {/* Image Pop-up Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowImageModal(false); setShowDetailsModal(true); }}
        >
          <div className="relative bg-white rounded-lg p-6 w-auto max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center items-center h-full">
              <img src={modalImageSrc} alt="Enlarged Document" className="object-contain max-h-[85vh] w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Driver"
        message="Are you sure you want to delete this driver? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Reject Driver</h2>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Please provide a reason for rejecting this driver.</p>
            <textarea
              className="w-full p-2 border rounded-lg"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={submitReject}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default ManageDrivers;