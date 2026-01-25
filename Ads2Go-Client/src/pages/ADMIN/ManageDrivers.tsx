import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useLocation } from 'react-router-dom';
import { X, Trash, Eye, ChevronLeft, ChevronDown, Car, Bike, User, IdCard, CalendarClock, Mail, CalendarCheck2, Phone, MapPin, Check, CheckCircle, AlertCircle, XCircle, ChevronRight, Archive, RotateCcw } from 'lucide-react';
import { GET_ALL_DRIVERS, GET_DRIVER_USAGE_HISTORY } from '../../graphql/admin/queries/manageDrivers';
import { GET_ALL_MATERIALS } from '../../graphql/admin/queries/materials';
import { GET_DRIVER_MATERIALS } from '../../graphql/admin/queries/driverMaterials';
import { APPROVE_MONTHLY_PHOTO, REJECT_MONTHLY_PHOTO } from '../../graphql/admin/mutations/compliance';
import { APPROVE_DRIVER, REJECT_DRIVER, DELETE_DRIVER, RESTORE_DRIVER } from '../../graphql/admin/mutations/manageDrivers';
import { UPDATE_DRIVER } from '../../graphql/admin/mutations/updateDriver';
import { SUSPEND_DRIVER } from '../../graphql/admin/mutations/suspendDriver';
import { GET_DRIVER_SALARY_SUMMARY, GET_DRIVER_SALARY_CALCULATIONS_BY_DRIVER } from '../../graphql/superadmin/queries/driverSalaryQueries';
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
  preferredMaterialType?: string[];
  address?: string;
  licenseNumber?: string;
  licensePictureURL?: string; // legacy single license
  orCrPictureURL?: string; // legacy combined OR/CR
  licenseFrontURL?: string;
  licenseBackURL?: string;
  orPictureURL?: string;
  crPictureURL?: string;
  vehiclePhotoURL?: string;
  profilePicture?: string;
  dateJoined: string;
  approvalDate?: string;
  rejectedReason?: string;
  suspensionReason?: string;
  createdAt: string;
  lastLogin?: string;
  material?: {
    materialId: string;
    materialType: string;
    category: string;
    description?: string;
  };
  // Archive fields
  isArchived?: boolean;
  archivedAt?: string | null;
  scheduledDeletionDate?: string | null;
  // Admin tracking fields
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  rejectedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  deletedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
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
const sortByOptions = ['Newest First', 'Oldest First', 'Alphabetical (A-Z)', 'Alphabetical (Z-A)'];
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
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [driverToRestore, setDriverToRestore] = useState<string | null>(null);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [selectedYear, setSelectedYear] = useState('All Years');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState('Newest First');
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [driverToReject, setDriverToReject] = useState<string | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [driverToSuspend, setDriverToSuspend] = useState<string | null>(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [driverToDelete, setDriverToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Processing states for double-click prevention
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [isProcessingRejection, setIsProcessingRejection] = useState(false);
  const [isProcessingDeletion, setIsProcessingDeletion] = useState(false);
  const [isProcessingSuspension, setIsProcessingSuspension] = useState(false);
  
  // Bulk actions state
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkSelectedMaterials, setBulkSelectedMaterials] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Refs for dropdown click-outside handling
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setShowMonthDropdown(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setShowYearDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const { data: driverSalaryData } = useQuery(GET_DRIVER_SALARY_SUMMARY, {
    variables: { driverId: selectedDriverDetails?.driverId || '' },
    skip: !selectedDriverDetails?.driverId,
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const { data: driverSalaryCalculationsData, loading: salaryCalculationsLoading, error: salaryCalculationsError } = useQuery(GET_DRIVER_SALARY_CALCULATIONS_BY_DRIVER, {
    variables: { driverId: selectedDriverDetails?.driverId || '' },
    skip: !selectedDriverDetails?.driverId,
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  // Calculate current month's salary
  const getCurrentMonthSalary = () => {
    // Don't calculate if query is still loading
    if (salaryCalculationsLoading) {
      return 0;
    }

    // Check if query has been executed and has data
    if (!driverSalaryCalculationsData) {
      return 0;
    }

    const response = driverSalaryCalculationsData.getDriverSalaryCalculationsByDriver;
    
    if (!response || !response.success || !response.calculations || response.calculations.length === 0) {
      return 0;
    }

    const calculations = response.calculations;

    // Use UTC to avoid timezone issues
    const now = new Date();
    const currentMonth = now.getUTCMonth(); // 0-indexed (0 = January, 11 = December)
    const currentYear = now.getUTCFullYear();

    const currentMonthCalculations = calculations.filter((calc: any) => {
      if (!calc.calculationPeriod?.startDate) {
        return false;
      }
      
      // Parse date - handle both ISO strings and timestamps
      let startDate: Date;
      const startDateValue = calc.calculationPeriod.startDate;
      
      try {
        if (typeof startDateValue === 'string') {
          // Check if it's a numeric string (timestamp)
          if (/^\d+$/.test(startDateValue)) {
            startDate = new Date(parseInt(startDateValue, 10));
          } else {
            startDate = new Date(startDateValue);
          }
        } else if (typeof startDateValue === 'number') {
          startDate = new Date(startDateValue);
        } else {
          startDate = new Date(startDateValue);
        }
        
        // Validate date
        if (isNaN(startDate.getTime())) {
          return false;
        }
        
        // Use UTC month and year for comparison to avoid timezone issues
        const calcMonth = startDate.getUTCMonth();
        const calcYear = startDate.getUTCFullYear();
        
        // Check if the calculation period is in the current month (using UTC)
        return calcMonth === currentMonth && calcYear === currentYear;
      } catch (error) {
        return false;
      }
    });

    const totalSalary = currentMonthCalculations.reduce((sum: number, calc: any) => {
      return sum + (calc.calculations?.totalSalary || 0);
    }, 0);

    return totalSalary;
  };

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

  const [restoreDriver] = useMutation(RESTORE_DRIVER, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const [updateDriver] = useMutation(UPDATE_DRIVER, {
    context: { headers: { authorization: `Bearer ${localStorage.getItem('token')}` } }
  });

  const [suspendDriver] = useMutation(SUSPEND_DRIVER, {
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
    // Filter by archive status based on active tab
    const isArchivedMatch = activeTab === 'archived' ? r.isArchived === true : r.isArchived !== true;
    
    if (!isArchivedMatch) return false;

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
  }).sort((a, b) => {
    switch (sortBy) {
      case 'Newest First':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'Oldest First':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'Alphabetical (A-Z)':
        const aName = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bName = `${b.firstName} ${b.lastName}`.toLowerCase();
        return aName.localeCompare(bName);
      case 'Alphabetical (Z-A)':
        const aNameZA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bNameZA = `${b.firstName} ${b.lastName}`.toLowerCase();
        return bNameZA.localeCompare(aNameZA);
      default:
        return 0;
    }
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
    
    // Prevent multiple clicks
    if (isProcessingApproval) {
      return;
    }
    
    setIsProcessingApproval(true);
    
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
    } finally {
      setIsProcessingApproval(false);
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
    
    // Prevent multiple clicks
    if (isProcessingRejection) {
      return;
    }
    
    setIsProcessingRejection(true);
    
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
    } finally {
      setIsProcessingRejection(false);
    }
  };

  const handleDelete = (driverId: string) => {
    setDriverToDelete(driverId);
    setShowDeleteModal(true);
  };

  // Get the driver object for the driver being deleted
  const driverBeingDeleted = data?.getAllDrivers?.find((driver: Driver) => driver.driverId === driverToDelete);
  const driverFullName = driverBeingDeleted ? `${driverBeingDeleted.firstName} ${driverBeingDeleted.middleName ? driverBeingDeleted.middleName + ' ' : ''}${driverBeingDeleted.lastName}`.trim() : '';

  const confirmDelete = async (reason?: string) => {
    if (!driverToDelete) return;
    
    // Prevent multiple clicks
    if (isProcessingDeletion) {
      return;
    }
    
    setIsProcessingDeletion(true);
    
    try {
      const result = await deleteDriver({ variables: { driverId: driverToDelete, reason: reason || null } });
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
    } finally {
      setIsProcessingDeletion(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDriverToDelete(null);
  };

  const handleRestore = (driverId: string) => {
    setDriverToRestore(driverId);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!driverToRestore) return;
    
    try {
      const result = await restoreDriver({ variables: { driverId: driverToRestore } });
      if (result.data?.restoreDriver?.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: 'Driver restored successfully.',
          duration: 5000
        });
      } else {
        addToast({
          type: 'error',
          title: 'Restore Failed',
          message: result.data?.restoreDriver?.message || 'Failed to restore driver',
          duration: 6000
        });
      }
      setShowRestoreModal(false);
      setDriverToRestore(null);
      refetch();
    } catch (error: any) {
      console.error('Error restoring driver:', error);
      addToast({
        type: 'error',
        title: 'Restore Failed',
        message: error.message || 'Failed to restore driver',
        duration: 6000
      });
      setShowRestoreModal(false);
      setDriverToRestore(null);
    }
  };

  const cancelRestore = () => {
    setShowRestoreModal(false);
    setDriverToRestore(null);
  };

  const handleSuspend = (driverId: string) => {
    setDriverToSuspend(driverId);
    setShowSuspendModal(true);
  };

  const handleUnsuspend = async (driverId: string) => {
    if (isProcessingSuspension) return;
    
    setIsProcessingSuspension(true);
    
    try {
      const result = await updateDriver({
        variables: {
          driverId,
          input: {
            accountStatus: 'ACTIVE'
          }
        }
      });
      
      if (result.data?.updateDriver?.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: 'Driver has been unsuspended successfully.',
          duration: 4000
        });
        refetch();
        if (selectedDriverDetails?.driverId === driverId) {
          setSelectedDriverDetails({ ...selectedDriverDetails, accountStatus: 'ACTIVE' });
        }
      } else {
        addToast({
          type: 'error',
          title: 'Unsuspension Failed',
          message: result.data?.updateDriver?.message || 'Failed to unsuspend driver',
          duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error unsuspending driver:', error);
      addToast({
        type: 'error',
        title: 'Unsuspension Failed',
        message: error.message || 'Failed to unsuspend driver',
        duration: 6000
      });
    } finally {
      setIsProcessingSuspension(false);
    }
  };

  const submitSuspend = async () => {
    if (!driverToSuspend) return;
    
    if (isProcessingSuspension) return;
    
    setIsProcessingSuspension(true);
    
    try {
      const result = await suspendDriver({
        variables: {
          driverId: driverToSuspend,
          reason: suspendReason.trim() || 'No reason provided'
        }
      });
      
      if (result.data?.suspendDriver?.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: 'Driver has been suspended successfully. An email notification has been sent.',
          duration: 4000
        });
        refetch();
        setShowSuspendModal(false);
        setSuspendReason('');
        setDriverToSuspend(null);
        if (selectedDriverDetails?.driverId === driverToSuspend) {
          const trimmedReason = suspendReason.trim();
          setSelectedDriverDetails({ 
            ...selectedDriverDetails, 
            accountStatus: 'SUSPENDED',
            suspensionReason: trimmedReason ? trimmedReason : undefined
          });
        }
      } else {
        addToast({
          type: 'error',
          title: 'Suspension Failed',
          message: result.data?.suspendDriver?.message || 'Failed to suspend driver',
          duration: 6000
        });
      }
    } catch (error: any) {
      console.error('Error suspending driver:', error);
      let errorMessage = 'Failed to suspend driver';
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.networkError) {
        errorMessage = `Network Error: ${error.networkError.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      addToast({
        type: 'error',
        title: 'Suspension Failed',
        message: errorMessage,
        duration: 6000
      });
    } finally {
      setIsProcessingSuspension(false);
    }
  };

  const cancelSuspend = () => {
    setShowSuspendModal(false);
    setSuspendReason('');
    setDriverToSuspend(null);
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

  // Bulk action handlers
  const handleBulkApprove = () => {
    if (selectedDrivers.length === 0) return;
    setShowBulkApproveModal(true);
  };

  const submitBulkApprove = async () => {
    if (bulkSelectedMaterials.length === 0) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please select at least one material type',
        duration: 4000
      });
      return;
    }

    setIsBulkProcessing(true);

    try {
      const results = await Promise.allSettled(
        selectedDrivers.map(driverId =>
          updateDriver({
            variables: {
              id: driverId,
              input: {
                status: 'APPROVED',
                materialsProvidedByCompany: bulkSelectedMaterials
              }
            }
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: `${successCount} driver(s) approved successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          duration: 5000
        });
      }

      if (failCount > 0 && successCount === 0) {
        addToast({
          type: 'error',
          title: 'Error!',
          message: `Failed to approve ${failCount} driver(s)`,
          duration: 5000
        });
      }

      setShowBulkApproveModal(false);
      setBulkSelectedMaterials([]);
      setSelectedDrivers([]);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Error approving drivers: ' + (err.message || 'Unknown error'),
        duration: 5000
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = () => {
    if (selectedDrivers.length === 0) return;
    setShowBulkRejectModal(true);
  };

  const submitBulkReject = async () => {
    if (!bulkRejectReason.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide a reason for rejection',
        duration: 4000
      });
      return;
    }

    setIsBulkProcessing(true);

    try {
      const results = await Promise.allSettled(
        selectedDrivers.map(driverId =>
          updateDriver({
            variables: {
              id: driverId,
              input: {
                status: 'REJECTED',
                reasonForReject: bulkRejectReason
              }
            }
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: `${successCount} driver(s) rejected successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          duration: 5000
        });
      }

      if (failCount > 0 && successCount === 0) {
        addToast({
          type: 'error',
          title: 'Error!',
          message: `Failed to reject ${failCount} driver(s)`,
          duration: 5000
        });
      }

      setShowBulkRejectModal(false);
      setBulkRejectReason('');
      setSelectedDrivers([]);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Error rejecting drivers: ' + (err.message || 'Unknown error'),
        duration: 5000
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDrivers.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const handleExportToCSV = () => {
    if (selectedDrivers.length === 0) return;

    const selectedDriverData = drivers.filter(d => selectedDrivers.includes(d.driverId));
    
    const csvData = selectedDriverData.map(driver => ({
      'Driver ID': driver.driverId,
      'First Name': driver.firstName,
      'Middle Name': driver.middleName || '',
      'Last Name': driver.lastName,
      'Email': driver.email,
      'Contact Number': driver.contactNumber,
      'Vehicle Type': driver.vehicleType,
      'Vehicle Model': driver.vehicleModel,
      'Vehicle Plate': driver.vehiclePlateNumber,
      'Account Status': driver.accountStatus,
      'Material Type': driver.installedMaterialType || 'N/A',
      'Date Joined': formatDate(driver.dateJoined),
      'Approval Date': driver.approvalDate ? formatDate(driver.approvalDate) : 'N/A',
      'Created At': formatDate(driver.createdAt)
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `drivers_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Export Successful!',
      message: `${selectedDrivers.length} driver(s) exported to CSV`,
      duration: 4000
    });
  };

  const confirmBulkDelete = async (reason?: string) => {
    setIsBulkProcessing(true);

    try {
      const results = await Promise.allSettled(
        selectedDrivers.map(driverId =>
          deleteDriver({
            variables: { driverId, reason: reason || null }
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: `${successCount} driver(s) deleted successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          duration: 5000
        });
      }

      if (failCount > 0 && successCount === 0) {
        addToast({
          type: 'error',
          title: 'Error!',
          message: `Failed to delete ${failCount} driver(s)`,
          duration: 5000
        });
      }

      setShowBulkDeleteModal(false);
      setSelectedDrivers([]);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Error deleting drivers: ' + (err.message || 'Unknown error'),
        duration: 5000
      });
    } finally {
      setIsBulkProcessing(false);
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
      className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-6 flex flex-col transition-all duration-300`}
    >
      {/* Mobile Header */}
      {isMobile && (
        <div className="flex items-center mb-4">
          <h1 className="text-xl font-bold text-gray-800">Drivers Management</h1>
        </div>
      )}

      {/* Header with Title and Filters */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        {!isMobile && (
          <h1 className="text-2xl pt-5 lg:text-3xl font-bold text-gray-800">Drivers Management</h1>
        )}
        
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          {/* Search Input */}
          <div className="w-full lg:w-80">
            <input
              type="text"
              className="w-full text-xs text-black rounded-lg pl-4 py-3 shadow-md focus:outline-none bg-white"
              placeholder="Search drivers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            {/* STATUS Filter */}
            <div className="relative flex-1 sm:flex-none sm:w-32" ref={statusDropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{selectedStatusFilter}</span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`}
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
                    {statusFilterOptions.map((status) => (
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

            {/* SORT BY Filter */}
            <div className="relative flex-1 sm:flex-none sm:w-40" ref={sortDropdownRef}>
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                <span className="truncate">{sortBy}</span>
                <ChevronDown
                  size={16}
                  className={`flex-shrink-0 transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {sortByOptions.map((sortOption) => (
                      <button
                        key={sortOption}
                        onClick={() => {
                          setSortBy(sortOption);
                          setShowSortDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {sortOption}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      {/* Tabs Section */}
      <div className="mb-4">
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`relative flex items-center py-4 px-2 font-medium text-sm transition-colors group ${
                activeTab === 'active' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Drivers
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300 ${
                  activeTab === 'active' ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`relative flex items-center py-4 px-2 font-medium text-sm transition-colors group ${
                activeTab === 'archived' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Archived Drivers
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300 ${
                  activeTab === 'archived' ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </button>
          </nav>
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
              <div className={`hidden md:grid gap-4 px-4 py-2 text-sm font-semibold text-black ${
                activeTab === 'archived' ? 'grid-cols-12' : 'grid-cols-12'
              }`}>
                <div className="flex items-center gap-2 col-span-3">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="form-checkbox appearance-none w-3.5 h-3.5 border border-gray-400 rounded cursor-pointer"
                      onChange={() => {}}
                      onClick={handleSelectAll}
                      checked={isAllSelected}
                    />
                    <AnimatePresence>
                      {isAllSelected && (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute text-black pointer-events-none"
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="cursor-pointer" onClick={handleSelectAll}>Name</span>
                </div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Contact</div>
                <div className="col-span-1">Vehicle</div>
                <div className="col-span-1 flex items-center gap-1 ml-4">
                  <span>Status</span>
                </div>
                {activeTab === 'archived' && <div className="col-span-1">Deletion Date</div>}
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
                  // Mobile Card Layout
                  <div className="p-4 cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="form-checkbox appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                            checked={selectedDrivers.includes(driver.driverId)}
                            onChange={() => {}}
                            onClick={(e) => handleSelect(driver.driverId, e)}
                          />
                          <AnimatePresence>
                            {selectedDrivers.includes(driver.driverId) && (
                              <motion.div
                                key="check"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className="absolute text-black pointer-events-none"
                              >
                                <Check size={12} strokeWidth={3} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white rounded-full bg-[#FF9D3D]">
                          {getInitials(driver.firstName, driver.lastName)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {driver.firstName} {driver.lastName}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">
                            {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'}
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
                      {activeTab === 'archived' ? (
                        <button
                          className="flex items-center text-green-700 px-1 py-1 rounded hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(driver.driverId);
                          }}
                        >
                          <RotateCcw size={14} />
                        </button>
                      ) : (
                        <>
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
                          className="flex items-center text-red-700 px-1 py-1 rounded hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(driver.driverId);
                          }}
                        >
                          <Trash size={14} />
                        </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  // Desktop Card Layout
                  <div className={`grid items-center px-6 py-3 text-sm transition-colors cursor-pointer rounded-lg ${
                    activeTab === 'archived' ? 'grid-cols-12' : 'grid-cols-12'
                  }`}>
                    <div className="col-span-3 gap-3 flex items-center">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="form-checkbox appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                          checked={selectedDrivers.includes(driver.driverId)}
                          onChange={() => {}}
                          onClick={(e) => handleSelect(driver.driverId, e)}
                        />
                        <AnimatePresence>
                          {selectedDrivers.includes(driver.driverId) && (
                            <motion.div
                              key="check"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="absolute text-black pointer-events-none"
                            >
                              <Check size={12} strokeWidth={3} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex items-center">
                        <ProfilePicture driver={driver} className="mr-3" isMobile={isMobile} />
                        <span className="truncate font-semibold">
                          {`${driver.firstName} ${driver.middleName || ''} ${driver.lastName}`}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3 truncate">{driver.email}</div>
                    <div className="col-span-2 truncate">{driver.contactNumber}</div>
                    <div className="col-span-1 truncate ml-5">{driver.vehicleType}</div>
                    <div className="col-span-1 ml-7">
                      <span
                        className={`px-2 py-1  text-xs font-medium rounded-full ${
                          driver.accountStatus === 'ACTIVE' ? 'bg-green-200 text-green-800' :
                          driver.accountStatus === 'PENDING' ? 'bg-yellow-200 text-yellow-800' :
                          driver.accountStatus === 'REJECTED' ? 'bg-red-200 text-red-800' :
                          'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {driver.accountStatus}
                      </span>
                    </div>
                    {activeTab === 'archived' && (
                      <div className="col-span-1 text-sm text-red-600 font-medium">
                        {driver.scheduledDeletionDate ? formatDate(driver.scheduledDeletionDate) : 'N/A'}
                      </div>
                    )}
                    <div className="col-span-2 flex items-center justify-center gap-1 ml-9" onClick={(e) => e.stopPropagation()}>
                    {activeTab === 'archived' ? (
                      <button
                        onClick={() => handleRestore(driver.driverId)}
                        className="group flex items-center text-green-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                      >
                        <RotateCcw 
                          className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                          size={16} />
                        <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                          Restore
                        </span>
                      </button>
                    ) : (
                      <>
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
                      </>
                    )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
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
            <p className="text-sm text-gray-600 mb-3">Choose one or more materials to approve for this driver. At least one material must be selected to proceed.</p>
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
                  <label key={mType} className="flex items-center justify-between text-sm px-3 py-2 shadow-md rounded-md">
                    <span className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                          checked={selectedMaterials.includes(mType)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedMaterials(prev => checked ? [...prev, mType] : prev.filter(x => x !== mType));
                          }}
                        />
                        <AnimatePresence>
                          {selectedMaterials.includes(mType) && (
                            <motion.div
                              key="check"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              className="absolute text-black pointer-events-none"
                            >
                              <Check size={12} strokeWidth={3} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className="font-medium">{mType}</span>
                    </span>
                    <span className="text-xs text-gray-600">{counts[mType]} available</span>
                  </label>
                ));
              })()}
            </div>
            <div className="flex gap-3 pt-8 justify-between">
              <button
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"                onClick={() => { setShowMaterialModal(false); setSelectedMaterials([]); }}
                disabled={isProcessingApproval}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 text-white rounded hover:shadow-md transition-colors flex items-center gap-2 ${
                  isProcessingApproval || selectedMaterials.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
                onClick={handleConfirmApproveWithMaterials}
                disabled={isProcessingApproval || selectedMaterials.length === 0}
              >
                {isProcessingApproval && (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                )}
                {isProcessingApproval ? 'Processing...' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDriverDetails && (
        <div className="fixed inset-0 overflow-hidden bg-black bg-opacity-50 z-[9999]" onClick={handleCloseModal}>
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
                        selectedDriverDetails.accountStatus === 'SUSPENDED' ? 'bg-orange-200 text-orange-800' :
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

                    <div className={`${isMobile ? "mb-2" : "mb-4"}`}>
                      <p className="text-xs sm:text-sm text-gray-500">Preferred Material</p>
                      <p className="text-gray-900 font-bold text-sm sm:text-base">
                        {selectedDriverDetails.preferredMaterialType && selectedDriverDetails.preferredMaterialType.length > 0
                          ? selectedDriverDetails.preferredMaterialType.join(', ')
                          : selectedDriverDetails.material?.materialType ||
                            selectedDriverDetails.installedMaterialType ||
                            "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Total Earnings (This Month)</p>
                      <p className="text-gray-900 font-bold text-sm sm:text-base text-green-600">
                        ₱{getCurrentMonthSalary().toFixed(2)}
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

              {/* Admin Actions History */}
              {(selectedDriverDetails.approvedBy || selectedDriverDetails.rejectedBy || selectedDriverDetails.deletedBy) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-3">Admin Actions</h3>
                  <div className="space-y-3">
                    {selectedDriverDetails.approvedBy && (
                      <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-green-900">Approved by</p>
                          <p className="text-sm text-green-700">
                            {selectedDriverDetails.approvedBy.firstName} {selectedDriverDetails.approvedBy.lastName}
                          </p>
                          <p className="text-xs text-green-600">{selectedDriverDetails.approvedBy.email}</p>
                          {selectedDriverDetails.approvalDate && (
                            <p className="text-xs text-green-600 mt-1">
                              {new Date(selectedDriverDetails.approvalDate).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedDriverDetails.rejectedBy && (
                      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <XCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-red-900">Rejected by</p>
                          <p className="text-sm text-red-700">
                            {selectedDriverDetails.rejectedBy.firstName} {selectedDriverDetails.rejectedBy.lastName}
                          </p>
                          <p className="text-xs text-red-600">{selectedDriverDetails.rejectedBy.email}</p>
                          {selectedDriverDetails.rejectedReason && (
                            <p className="text-xs text-red-700 mt-2 italic">Reason: {selectedDriverDetails.rejectedReason}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedDriverDetails.deletedBy && (
                      <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <AlertCircle size={20} className="text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-orange-900">Archived by</p>
                          <p className="text-sm text-orange-700">
                            {selectedDriverDetails.deletedBy.firstName} {selectedDriverDetails.deletedBy.lastName}
                          </p>
                          <p className="text-xs text-orange-600">{selectedDriverDetails.deletedBy.email}</p>
                          {selectedDriverDetails.archivedAt && (
                            <p className="text-xs text-orange-600 mt-1">
                              {new Date(selectedDriverDetails.archivedAt).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    // Prefer new separate fields; fall back to legacy
                    { src: selectedDriverDetails.licenseFrontURL || selectedDriverDetails.licensePictureURL, title: 'Driver License (Front)' },
                    { src: selectedDriverDetails.licenseBackURL, title: 'Driver License (Back)' },
                    { src: selectedDriverDetails.orPictureURL || selectedDriverDetails.orCrPictureURL, title: 'OR (Official Receipt)' },
                    { src: selectedDriverDetails.crPictureURL, title: 'CR (Certificate of Registration)' },
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

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap gap-2 justify-end pt-6">
                {selectedDriverDetails.accountStatus === 'PENDING' && (
                  <>
                    <button
                      onClick={() => openApprovalWithMaterialSelection(selectedDriverDetails)}
                      className="px-4 py-2 bg-green-200 text-green-600 font-medium rounded hover:bg-green-100 transition-colors flex items-center gap-2"
                    >
                      <Check size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(selectedDriverDetails.driverId)}
                      className="px-4 py-2 bg-red-200 text-red-500 font-medium rounded hover:bg-red-100 transition-colors flex items-center gap-2"
                    >
                      <X size={16} />
                      Reject
                    </button>
                  </>
                )}
                {selectedDriverDetails.accountStatus === 'ACTIVE' && (
                  <button
                    onClick={() => handleSuspend(selectedDriverDetails.driverId)}
                    className="px-4 py-2 bg-orange-200 text-orange-600 font-medium rounded hover:bg-orange-100 transition-colors flex items-center gap-2"
                  >
                    <AlertCircle size={16} />
                    Suspend Driver
                  </button>
                )}
                {selectedDriverDetails.accountStatus === 'SUSPENDED' && (
                  <button
                    onClick={() => handleUnsuspend(selectedDriverDetails.driverId)}
                    disabled={isProcessingSuspension}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isProcessingSuspension ? (
                      <>
                        <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Unsuspend Driver
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selectedDriverDetails.driverId)}
                  className="px-1 text-red-600 font-medium rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Suspend Driver</h3>
              <button onClick={cancelSuspend} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Please provide a reason for suspending this driver (optional).</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={4}
            />
            <div className="mt-4 flex justify-between gap-3">
              <button
                onClick={cancelSuspend}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitSuspend}
                disabled={isProcessingSuspension}
                className={`px-4 py-2 text-white rounded transition-colors flex items-center gap-2 ${
                  isProcessingSuspension
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-500'
                }`}
              >
                {isProcessingSuspension && (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                )}
                {isProcessingSuspension ? 'Suspending...' : 'Suspend Driver'}
              </button>
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
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4"
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
        confirmButtonClass="bg-red-600 hover:shadow-md"
        isProcessing={isProcessingDeletion}
        requireTitleConfirmation={true}
        confirmationTitle={driverFullName}
        requireReason={true}
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-bold">Reject Driver</h2>
            </div>
            <div className="relative w-full">
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                required
                className={`peer w-full px-0 pb-2 text-gray-900 bg-white pt-6 border-b bg-transparent focus:outline-none focus:border-blue-500 ${
                  !rejectReason ? 'border-gray-300' : 'border-gray-400'
                }`}
                style={{ backgroundColor: 'transparent' }}
              />
              <label
                htmlFor="reject-reason"
                className={`absolute left-0 top-12 text-gray-700 bg-white w-full transition-all duration-200 ${
                  rejectReason
                    ? '-top-0 text-sm text-gray-700 font-bold'
                    : 'peer-placeholder-shown:top-10 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
                } peer-focus:-top-0 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
              >
                Reason for Rejection
              </label>
            </div>

            <div className="flex gap-3 justify-between mt-4">
              <button
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"                onClick={() => setShowRejectModal(false)}
                disabled={isProcessingRejection}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded hover:shadow-md transition-colors flex items-center gap-2 ${
                  isProcessingRejection
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 text-white font-semibold'
                }`}
                onClick={submitReject}
                disabled={isProcessingRejection}
              >
                {isProcessingRejection && (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                )}
                {isProcessingRejection ? 'Processing...' : 'Reject Driver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approve Modal */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Approve {selectedDrivers.length} Driver(s)</h2>
              <button
                onClick={() => {
                  setShowBulkApproveModal(false);
                  setBulkSelectedMaterials([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Select the materials that will be provided by the company to these drivers:
            </p>

            <div className="space-y-2 mb-6">
              {['Helmet', 'Shirt', 'Tablet', 'Phone', 'Other'].map((material) => (
                <label key={material} className="flex items-center gap-2 cursor-pointer">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                      checked={bulkSelectedMaterials.includes(material)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkSelectedMaterials([...bulkSelectedMaterials, material]);
                        } else {
                          setBulkSelectedMaterials(bulkSelectedMaterials.filter(m => m !== material));
                        }
                      }}
                    />
                    <AnimatePresence>
                      {bulkSelectedMaterials.includes(material) && (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute text-black pointer-events-none"
                        >
                          <Check size={12} strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-sm">{material}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowBulkApproveModal(false);
                  setBulkSelectedMaterials([]);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                disabled={isBulkProcessing}
              >
                Cancel
              </button>
              <button
                onClick={submitBulkApprove}
                disabled={bulkSelectedMaterials.length === 0 || isBulkProcessing}
                className={`px-4 py-2 text-white rounded ${
                  bulkSelectedMaterials.length === 0 || isBulkProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isBulkProcessing ? 'Processing...' : `Approve ${selectedDrivers.length} Driver${selectedDrivers.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {showBulkRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Reject {selectedDrivers.length} Driver(s)</h2>
              <button
                onClick={() => {
                  setShowBulkRejectModal(false);
                  setBulkRejectReason('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative mb-6">
              <textarea
                id="bulkRejectReason"
                name="bulkRejectReason"
                required
                value={bulkRejectReason}
                onChange={(e) => {
                  setBulkRejectReason(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
                placeholder=" "
                className={`peer w-full px-0 pt-6 pb-2 text-gray-800 border-b bg-transparent focus:outline-none focus:border-blue-500 placeholder-transparent transition
                  ${!bulkRejectReason.trim() ? 'border-gray-300' : 'border-gray-400'}
                `}
                style={{
                  minHeight: "40px",
                  maxHeight: "100px",
                  resize: "none",
                  overflowY: "auto",
                }}
              />

              <label
                htmlFor="bulkRejectReason"
                className={`absolute left-0 bg-white text-gray-600 transition-all duration-200
                  ${
                    bulkRejectReason
                      ? '-top-2 text-sm text-blue-600 font-semibold'
                      : 'peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
                  }
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold`}
              >
                Reason for rejection
              </label>

              <p className="mt-1 text-xs text-gray-500">This reason will be visible to the affected drivers.</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowBulkRejectModal(false);
                  setBulkRejectReason('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                disabled={isBulkProcessing}
              >
                Cancel
              </button>
              <button
                onClick={submitBulkReject}
                disabled={!bulkRejectReason.trim() || isBulkProcessing}
                className={`px-4 py-2 text-white rounded ${
                  !bulkRejectReason.trim() || isBulkProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {isBulkProcessing ? 'Processing...' : `Reject ${selectedDrivers.length} Driver${selectedDrivers.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Multiple Drivers"
        message={`Are you sure you want to delete ${selectedDrivers.length} driver(s)? This action cannot be undone.`}
        confirmText={`Delete ${selectedDrivers.length} Driver${selectedDrivers.length > 1 ? 's' : ''}`}
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isProcessing={isBulkProcessing}
        requireReason={true}
      />

      {/* Restore Confirmation Modal */}
      {showRestoreModal && driverToRestore && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-md p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Restore Driver</h2>
              <button
                onClick={cancelRestore}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to restore this driver?
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelRestore}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Restore
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