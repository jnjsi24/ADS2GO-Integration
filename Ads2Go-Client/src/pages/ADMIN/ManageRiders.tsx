import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { X, Trash, Eye, ChevronDown, User, IdCard, CalendarClock, Mail,  CalendarCheck2, Phone, MapPin, Check, CheckCircle, AlertCircle, XCircle} from 'lucide-react';
import { GET_ALL_DRIVERS } from '../../graphql/admin/queries/manageRiders';
import { APPROVE_DRIVER, REJECT_DRIVER, DELETE_DRIVER } from '../../graphql/admin/mutations/manageRiders';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';


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

// Helper to get full image URL
const getImageUrl = (imagePath: string | undefined | null) => {
  if (!imagePath) return null;
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  // If it starts with /uploads, prepend your server URL
  if (imagePath.startsWith('/uploads')) {
    // Replace with your actual server URL
    return `${process.env.REACT_APP_SERVER_URL || 'https://ads2go-integration-production.up.railway.app'}${imagePath}`;
  }
  return imagePath;
};

// Profile Picture Component
const ProfilePicture: React.FC<{ 
  driver: Driver; 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ driver, size = 'sm', className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = getImageUrl(driver.profilePicture);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-24 h-24 text-lg'
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

  // Fallback to initials
  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center font-semibold text-white rounded-full bg-[#FF9D3D] ${className}`}>
      {getInitials(driver.firstName, driver.lastName)}
    </div>
  );
};

// Document Image Component with Error Handling
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

// Generate month options
const monthOptions = [
  'All Months',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Generate year options (current year and previous 5 years)
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
  const [showRejectionNotification, setShowRejectionNotification] = useState(true);
  const [driverToReject, setDriverToReject] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<string | null>(null);

  // Toast notification state
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    duration?: number;
  }>>([]);

  // Toast notification functions
  const addToast = (toast: Omit<typeof toasts[0], 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove toast after duration (default 5 seconds)
    setTimeout(() => {
      removeToast(id);
    }, toast.duration || 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Apollo hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_DRIVERS, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const [approveDriver] = useMutation(APPROVE_DRIVER, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const [rejectDriver] = useMutation(REJECT_DRIVER, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const [deleteDriver] = useMutation(DELETE_DRIVER, {
    context: {
      headers: {
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
  });

  const drivers: Driver[] = data?.getAllDrivers || [];

  // Filter
  const filteredDrivers = drivers.filter((r: Driver) => {
    const fullName = `${r.firstName} ${r.middleName || ''} ${r.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                         r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.contactNumber.includes(searchTerm) ||
                         r.driverId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatusFilter === 'All Status' || r.accountStatus.toLowerCase() === selectedStatusFilter.toLowerCase();

    // Date filter logic
    let matchesDate = true;
    if (selectedMonth !== 'All Months' || selectedYear !== 'All Years') {
      const createdAt = new Date(r.createdAt);
      const riderMonth = createdAt.toLocaleString('default', { month: 'long' });
      const riderYear = createdAt.getFullYear().toString();
      
      const matchesMonth = selectedMonth === 'All Months' || riderMonth === selectedMonth;
      const matchesYear = selectedYear === 'All Years' || riderYear === selectedYear;
      
      matchesDate = matchesMonth && matchesYear;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Actions
  const handleApprove = async (driverId: string) => {
    try {
      const result = await approveDriver({
        variables: { driverId, materialTypeOverride: null }
      });
      
      if (result.data?.approveDriver?.success) {
        addToast({
          type: 'success',
          title: 'Driver Approved',
          message: result.data.approveDriver.message,
          duration: 4000
        });
        refetch();
      } else {
        addToast({
          type: 'error',
          title: 'Approval Failed',
          message: result.data?.approveDriver?.message || 'Failed to approve driver',
          duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error approving driver:', error);
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: error.message || 'Failed to approve driver',
        duration: 6000
      });
    }
  };

  // Approve with selected materials from popup
  const handleConfirmApproveWithMaterials = async () => {
    if (!selectedDriverDetails) return;
    try {
      const override = selectedMaterials.length > 0 ? selectedMaterials : null;
      const result = await approveDriver({
        variables: { driverId: selectedDriverDetails.driverId, materialTypeOverride: override }
      });

      if (result.data?.approveDriver?.success) {
        addToast({
          type: 'success',
          title: 'Driver Approved',
          message: result.data.approveDriver.message,
          duration: 4000
        });
        setShowMaterialModal(false);
        setShowDetailsModal(false);
        setSelectedMaterials([]);
        refetch();
      } else {
        addToast({
          type: 'error',
          title: 'Approval Failed',
          message: result.data?.approveDriver?.message || 'Failed to approve driver',
          duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error approving driver with materials:', error);
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: error.message || 'Failed to approve driver',
        duration: 6000
      });
    }
  };

  const handleReject = (driverId: string) => {
    setDriverToReject(driverId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!driverToReject || !rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const result = await rejectDriver({
        variables: { 
          driverId: driverToReject, 
          reason: rejectReason.trim() 
        }
      });

      if (result.data?.rejectDriver?.success) {
        alert(result.data.rejectDriver.message);
        refetch();
        setShowRejectModal(false);
        setRejectReason('');
        setDriverToReject(null);
      } else {
        alert(result.data?.rejectDriver?.message || 'Failed to reject driver');
      }
    } catch (error: any) {
      console.error('Error rejecting driver:', error);
      // More detailed error handling
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        alert(`GraphQL Error: ${error.graphQLErrors[0].message}`);
      } else if (error.networkError) {
        alert(`Network Error: ${error.networkError.message}`);
      } else {
        alert(error.message || 'Failed to reject driver');
      }
    }
  };

  const handleDelete = (driverId: string) => {
    setDriverToDelete(driverId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (driverToDelete) {
      try {
        const result = await deleteDriver({ 
          variables: { driverId: driverToDelete } 
        });

        if (result.data?.deleteDriver?.success) {
          alert(result.data.deleteDriver.message);
          refetch();
        } else {
          alert(result.data?.deleteDriver?.message || 'Failed to delete driver');
        }
        setShowDeleteModal(false);
        setDriverToDelete(null);
      } catch (error: any) {
        console.error('Error deleting driver:', error);
        alert(error.message || 'Failed to delete driver');
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
    // Trigger animation after modal is rendered
    setTimeout(() => {
      setIsModalOpen(true);
    }, 10);
    if (driver.accountStatus === 'REJECTED') {
    setShowRejectionNotification(true);
  }
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setShowDetailsModal(false);
      setSelectedDriverDetails(null);
    }, 300); // Matches the transition duration
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  // Selection
  const handleSelect = (id: string) => {
    setSelectedDrivers(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allIds = filteredDrivers.map((r: Driver) => r.driverId);
    setSelectedDrivers(prev => prev.length === allIds.length ? [] : allIds);
  };

  const isAllSelected =
    selectedDrivers.length === filteredDrivers.length && filteredDrivers.length > 0;

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
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      {/* Toast Notifications */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              className={`max-w-md w-full mx-4 bg-white shadow-xl rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${
                toast.type === 'success' ? 'border-l-4 border-green-400' :
                toast.type === 'error' ? 'border-l-4 border-red-400' :
                toast.type === 'warning' ? 'border-l-4 border-yellow-400' :
                'border-l-4 border-blue-400'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {toast.type === 'success' && <CheckCircle className="h-8 w-8 text-green-400" />}
                    {toast.type === 'error' && <XCircle className="h-8 w-8 text-red-400" />}
                    {toast.type === 'warning' && <AlertCircle className="h-8 w-8 text-yellow-400" />}
                    {toast.type === 'info' && <AlertCircle className="h-8 w-8 text-blue-400" />}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-lg font-medium text-gray-900">{toast.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{toast.message}</p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button
                      className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      onClick={() => removeToast(toast.id)}
                    >
                      <span className="sr-only">Close</span>
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header with Title and Filters */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Drivers Management</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name or Driver ID..."
            className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {/* Status Filter Dropdown */}
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

          {/* Month Filter Dropdown */}
          <div className="relative w-32">
            <button
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
              {selectedMonth}
              <ChevronDown size={16} className={`transform transition-transform duration-200 ${showMonthDropdown ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            <AnimatePresence>
              {showMonthDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                >
                  {monthOptions.map((month) => (
                    <button
                      key={month}
                      onClick={() => {
                        setSelectedMonth(month);
                        setShowMonthDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {month}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Year Filter Dropdown */}
          <div className="relative w-32">
            <button
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
              {selectedYear}
              <ChevronDown size={16} className={`transform transition-transform duration-200 ${showYearDropdown ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            <AnimatePresence>
              {showYearDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {yearOptions.map((year) => (
                    <button
                      key={year}
                      onClick={() => {
                        setSelectedYear(year);
                        setShowYearDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
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

      {/* Table */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading drivers...</div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">Error: {error.message}</div>
      ) : filteredDrivers.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm ? 'No drivers match your search criteria' : 'No drivers found'}
        </div>
      ) : (
        <div className="rounded-md mb-4 overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-2 text-sm font-semibold text-gray-600">
            <div className="flex items-center gap-2 ml-1 col-span-3">
              <input
                type="checkbox"
                className="form-checkbox"
                onChange={(e) => {}}
                onClick={handleSelectAll}
                checked={isAllSelected}
              />
              <span className="cursor-pointer ml-2" onClick={handleSelectAll}>Name</span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
            </div>
            <div className="col-span-3 ml-16">Email</div>
            <div className="col-span-2">Contact</div>
            <div className="col-span-1">Vehicle</div>
            <div className="col-span-1 ml-10 flex items-center gap-1">
              <span>Status</span>
              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
              
            </div>
            <div className="col-span-1 ml-24 text-center">Action</div>
          </div>

          {filteredDrivers.map((r: Driver) => (
            <div key={r.driverId} className="bg-white mb-3 rounded-lg shadow-md">
              <div
                className="grid grid-cols-12 items-center px-5 py-4 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleViewDetails(r)}
              >
                <div className="col-span-3 gap-7 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedDrivers.includes(r.driverId)}
                    onChange={(e) => {
                      e.stopPropagation(); // Prevents row click when checkbox is clicked
                      handleSelect(r.driverId);
                    }}
                  />
                  <div className="flex items-center">
                    <ProfilePicture driver={r} className="mr-2" />
                    <span className="truncate">
                      {`${r.firstName} ${r.middleName || ''} ${r.lastName}`}
                    </span>
                  </div>
                </div>
                <div className="col-span-3 truncate">{r.email}</div>
                <div className="col-span-2 truncate">{r.contactNumber}</div>
                <div className="col-span-1 truncate">{r.vehicleType}</div>
                <div className="col-span-1 ml-10">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    r.accountStatus === 'ACTIVE'
                      ? 'bg-green-200 text-green-800'
                      : r.accountStatus === 'PENDING'
                      ? 'bg-yellow-200 text-yellow-800'
                      : r.accountStatus === 'REJECTED'
                      ? 'bg-red-200 text-red-800'
                      : 'bg-gray-200 text-gray-800'
                  }`}>
                    {r.accountStatus}
                  </span>
                </div>
                <div className="col-span-2 ml-16 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {r.accountStatus === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApprove(r.driverId)}
                        className="group flex items-center bg-green-200 hover:bg-green-200 text-green-700 rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-20 transition-[width] duration-300"
                      >
                        <Check className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                          <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                          Accept
                        </span>
                      </button>
                      <button
                        onClick={() => handleReject(r.driverId)}
                        className="group flex items-center bg-red-200 hover:bg-red-200 text-red-700 rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-16 transition-[width] duration-300"
                      >
                        <X className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                        <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 text-xs whitespace-nowrap transition-all duration-300">
                          Reject
                        </span>
                      </button>

                    </>
                  )}
                  <button
                    onClick={() => handleDelete(r.driverId)}
                    className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                  >
                    <Trash 
                      className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                      size={16} />
                    <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                      Delete
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
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
              {['CAR_TOP', 'CAR_BODY', 'TRICYCLE_REAR', 'BICYCLE_FRAME', 'MOTORCYCLE_SIDE', 'OTHER'].map((m) => (
                <label key={m} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(m)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedMaterials(prev => checked ? [...prev, m] : prev.filter(x => x !== m));
                    }}
                  />
                  <span>{m.replace('_', ' ')}</span>
                </label>
              ))}
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

      {/* Details Modal (Slide-in from right) */}
      {showDetailsModal && selectedDriverDetails && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} // Custom backdrop
          onClick={handleCloseModal}
        >
          <div
            className={`fixed top-2 bottom-2 right-2 max-w-xl w-full bg-white shadow-xl rounded-lg flex flex-col transform transition-transform duration-300 ease-in-out 
              ${isModalOpen ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Section (Fixed) */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between text-black">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <ProfilePicture driver={selectedDriverDetails} size="lg" className="ring-2 ring-white" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold">
                        {`${selectedDriverDetails.firstName} ${selectedDriverDetails.middleName || ""} ${selectedDriverDetails.lastName}`}
                      </h2>
                      {/* Status Badge */}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          selectedDriverDetails.accountStatus === "ACTIVE"
                            ? "bg-green-200 text-green-800"
                            : selectedDriverDetails.accountStatus === "PENDING"
                            ? "bg-yellow-200 text-yellow-800"
                            : selectedDriverDetails.accountStatus === "REJECTED"
                            ? "bg-red-200 text-red-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {selectedDriverDetails.accountStatus}
                      </span>
                    </div>
                    <span className="text-sm font-light opacity-80">{selectedDriverDetails.driverId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Vehicle Information */}
              <div className="mb-6">
                <h3 className="text-xl text-center font-bold text-gray-800 mb-4">Vehicle Information</h3>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-96 mx-auto divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Vehicle Type</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.vehicleType}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Vehicle Model</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.vehicleModel}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Plate Number</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">{selectedDriverDetails.vehiclePlateNumber}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Material Information */}
              <div className="mb-6">
                <h3 className="text-xl text-center font-bold text-gray-800 mb-4">Material Information</h3>
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-96 mx-auto divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Assigned Material</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                          {selectedDriverDetails.material?.materialId || 
                           selectedDriverDetails.material?.materialName || 
                           selectedDriverDetails.material?.description || 
                           selectedDriverDetails.installedMaterialType || 
                           'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Assigned Date</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                          {selectedDriverDetails.material?.assignedDate ? 
                            new Date(selectedDriverDetails.material.assignedDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : 
                            selectedDriverDetails.material?.mountedAt ?
                            new Date(selectedDriverDetails.material.mountedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) :
                            'N/A'
                          }
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">Preferred Material</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                          {selectedDriverDetails.material?.materialType || selectedDriverDetails.installedMaterialType || 'N/A'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Driver Details */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-center text-gray-800 mb-4">Driver Details:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
                  <div className="flex items-center space-x-3">
                    <IdCard size={20} className="text-gray-500" />
                    <p className='text-black'>{selectedDriverDetails.licenseNumber}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail size={20} className="text-gray-500" />
                    <p className='text-black'>{selectedDriverDetails.email}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CalendarClock size={20} className="text-gray-500" />
                    <p className='text-black'>{formatDate(selectedDriverDetails.createdAt)}</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <MapPin size={20} className="text-gray-500" />
                    <p className='text-black'>{selectedDriverDetails.address || 'N/A'}</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <CalendarCheck2 size={20} className="text-gray-500" />
                    <p className='text-black'>{formatDate(selectedDriverDetails.lastLogin)}</p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Phone size={20} className="text-gray-500" />
                    <p className='text-black'>{selectedDriverDetails.contactNumber}</p>
                  </div>
                </div>
              </div>

              {/* Documents & Photos Carousel */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Documents & Photos</h3>
                {selectedDriverDetails && (() => {
                  const documents = [
                    { src: selectedDriverDetails.profilePicture, title: 'Profile Picture' },
                    { src: selectedDriverDetails.licensePictureURL, title: 'Driver License' },
                    { src: selectedDriverDetails.orCrPictureURL, title: 'OR/CR Document' },
                    { src: selectedDriverDetails.vehiclePhotoURL, title: 'Vehicle Photo' },
                  ].filter(doc => doc.src); // Filter out any documents with a null or undefined source

                  if (documents.length === 0) {
                    return <p className="text-center text-gray-500">No documents or photos available.</p>;
                  }

                  return (
                    <div className="relative">
                      {/* Navigation Buttons */}
                      <button
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 text-black p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity z-10"
                        onClick={() =>
                          setCurrentImageIndex(prevIndex =>
                            prevIndex === 0 ? documents.length - 1 : prevIndex - 1
                          )
                        }
                        aria-label="Previous image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                      <button
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 text-black p-2 rounded-full opacity-75 hover:opacity-100 transition-opacity z-10"
                        onClick={() =>
                          setCurrentImageIndex(prevIndex =>
                            prevIndex === documents.length - 1 ? 0 : prevIndex + 1
                          )
                        }
                        aria-label="Next image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>

                      {/* Carousel Display */}
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
            
            {/* Rejection Notification */}
            {selectedDriverDetails.accountStatus === 'REJECTED' && showRejectionNotification && (
              <div className="fixed bottom-2 right-2 bg-red-600 text-white text-xs p-3 rounded-md shadow-lg max-w-sm z-50 flex justify-between items-start">
                <div>
                  <div className="font-bold mb-1">Driver account has been rejected.</div>
                  <p className="text-lg">Reason: {selectedDriverDetails.rejectedReason || 'No reason provided.'}</p>
                </div>
                <button
                  onClick={() => setShowRejectionNotification(false)}
                  className="text-white hover:text-gray-200 pl-5"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Reject Driver</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setDriverToReject(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={4}
                placeholder="Please provide a detailed reason for rejecting this driver..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">This reason will be visible to the driver.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setDriverToReject(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
              >
                Reject Driver
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Image Pop-up Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 text-black rounded-full p-1 hover:bg-gray-300 transition-colors z-20"
            >
              <X size={20} />
            </button>
            
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
    </div>
  );
};

export default ManageDrivers;