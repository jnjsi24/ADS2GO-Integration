import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Trash, 
  Tablet, 
  CalendarClock, 
  CalendarX2, 
  Mail, 
  CalendarRange, 
  Coins,
  Monitor,
  Calendar,
  PlayCircle,
  Building2,
  BarChart3,
  ChevronDown,
  Check,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Archive,
  RotateCcw
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';
import { ToastContainer } from '../../components/ToastNotification';

import {
  GET_ALL_ADS,
  UPDATE_AD,
  DELETE_AD,
  type Ad,
  type User
} from '../../graphql/admin/ads';
import ScheduleTab from './tabs/manageAds/ScheduleTab';
import DeploymentTab from './tabs/manageAds/DeploymentTab';
import CompanyAdsManagement from './tabs/manageAds/CompanyAdsManagement';
import DateFilter from '../../components/DateFilter';
import CalendarWidget from '../../components/CalendarWidget';
import { AdminLoader } from "../../components/ProtectedRoute";

const ManageAds: React.FC = () => {
  const { admin, isLoading, isInitialized } = useAdminAuth();
  const location = useLocation();
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Tab management
  const [activeTab, setActiveTab] = useState<'ads' | 'archived' | 'schedule' | 'deployment' | 'company-ads'>('ads');
  
  // Existing state
  const [searchTerm, setSearchTerm] = useState('');
  // Status filter options
  const statusFilterOptions = ['All Status', 'Approved', 'Pending', 'Scheduled', 'Running', 'Rejected'];
  const deploymentStatusFilterOptions = ['All Status', 'RUNNING', 'SCHEDULED', 'COMPLETED', 'PAUSED'];
  const sortByOptions = ['Newest First', 'Oldest First', 'Start Date (Newest)', 'End Date (Soonest)', 'Alphabetical (A-Z)', 'Alphabetical (Z-A)'];

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedSortBy, setSelectedSortBy] = useState('Newest First');
  
  const [showTabsDropdown, setShowTabsDropdown] = useState(false);
  const tabsDropdownRef = useRef<HTMLDivElement>(null);
  const [showAdDetailsModal, setShowAdDetailsModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adToReject, setAdToReject] = useState<string | null>(null);
  
  // Bulk actions state
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // Loading states for approve/reject buttons
  const [processingApprove, setProcessingApprove] = useState<Set<string>>(new Set());
  const [processingReject, setProcessingReject] = useState<Set<string>>(new Set());


  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);

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
    // Note: Toast removal is handled by ToastNotification component's timer
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const [adsStatusFilter, setAdsStatusFilter] = useState('All Status');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('All Status');

  // Check URL parameters for status filter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const statusParam = urlParams.get('status');
    if (statusParam === 'pending') {
      setAdsStatusFilter('Pending');
      setSelectedStatusFilter('Pending');
    }
  }, [location.search]);

  // Close tabs dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showTabsDropdown && tabsDropdownRef.current && !tabsDropdownRef.current.contains(target)) {
        setShowTabsDropdown(false);
      }
    };

    if (showTabsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTabsDropdown]);
  const [deploymentStatusFilter, setDeploymentStatusFilter] = useState('All Status');
  
  // Date filter state for schedule tab
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState<{
    startDate: Date | null;
    endDate: Date | null;
    condition: string;
  } | null>(null);
  
  // Calendar widget state for schedule tab
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adToDelete, setAdToDelete] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Close calendar when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCalendar) {
        const target = event.target as Element;
        if (!target.closest('.calendar-container')) {
          setShowCalendar(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  


  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    variables: {
      includeArchived: activeTab === 'archived'
    }
  });

  // Reset to first page when filters change or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, adsStatusFilter, selectedSortBy, activeTab]);

  const handleViewAdDetails = (ad: Ad) => {
  // Debug: Log admin fields to see if they're present
  console.log('Ad admin fields:', {
    approvedBy: ad.approvedBy,
    rejectedBy: ad.rejectedBy,
    deletedBy: ad.deletedBy,
    adId: ad.id,
    adTitle: ad.title
  });
  
  setSelectedAd(ad);
  setShowAdDetailsModal(true);

  // Trigger slide-in animation after modal is rendered
  setTimeout(() => {
    setIsAdModalOpen(true);
  }, 10);
};


  const handleCloseAdModal = () => {
  setIsAdModalOpen(false); // trigger slide-out
  setTimeout(() => {
    setShowAdDetailsModal(false);
    setSelectedAd(null);
  }, 300); // match the duration of your transition
};



  const [updateAd] = useMutation(UPDATE_AD, {
    onCompleted: (data) => {
      console.log('Ad updated successfully:', data);
      refetch(); // Refresh the ads list
    },
    onError: (error) => {
      console.error('Error updating ad:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: `Error updating ad: ${error.message}`,
        duration: 6000
      });
    }
  });

  const [deleteAd] = useMutation(DELETE_AD, {
    onCompleted: () => {
      refetch(); // Refresh the ads list
    },
    onError: (error) => {
      console.error('Error deleting ad:', error);
      addToast({
        type: 'error',
        title: 'Deletion Failed',
        message: `Error deleting ad: ${error.message}`,
        duration: 6000
      });
    }
  });


  // Show loading state while authentication is being checked
  if (isLoading || !isInitialized) {
    return <AdminLoader />;  }

  // Check if admin is authenticated
  if (!admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    );
  }


  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getAdvertiserName = (user: User | null) => {
    if (!user) return 'N/A';
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    return user.email || 'N/A';
  };

  const getAdminName = (admin: { firstName: string; lastName: string; email: string } | null | undefined) => {
    if (!admin) return 'N/A';
    if (admin.firstName && admin.lastName) return `${admin.firstName} ${admin.lastName}`;
    return admin.email || 'N/A';
  };

  // Actions
  const handleApprove = async (adId: string) => {
    if (processingApprove.has(adId)) return;
    setProcessingApprove(prev => new Set(prev).add(adId));
  
    try {
      await updateAd({ variables: { id: adId, input: { status: 'APPROVED' } } });
      addToast({ type: 'success', title: 'Success!', message: 'Advertisement approved successfully.' });
    } catch (error) {
      console.error('Error approving ad:', error);
      addToast({ type: 'error', title: 'Error!', message: 'Something went wrong.' });
    } finally {
      setProcessingApprove(prev => {
        const next = new Set(prev);
        next.delete(adId);
        return next;
      });
    }
  };

  const handleReject = (adId: string) => {
    setAdToReject(adId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!adToReject || !rejectReason.trim()) {
      addToast({ type: 'warning', title: 'Missing Information', message: 'Please provide a reason for rejection' });
      return;
    }
  
    if (processingReject.has(adToReject)) return;
    setProcessingReject(prev => new Set(prev).add(adToReject));
  
    try {
      await updateAd({ variables: { id: adToReject, input: { status: 'REJECTED', reasonForReject: rejectReason } } });
      setShowRejectModal(false);
      setRejectReason('');
      setAdToReject(null);
    } catch (error) {
      console.error('Error rejecting ad:', error);
      addToast({ type: 'error', title: 'Error!', message: 'Something went wrong.' });
    } finally {
      setProcessingReject(prev => {
        const next = new Set(prev);
        next.delete(adToReject);
        return next;
      });
    }
  };

  const handleDelete = (adId: string) => {
    setAdToDelete(adId);
    setShowDeleteModal(true);
  };

  // Get the ad object for the ad being deleted
  const adBeingDeleted = data?.getAllAds?.find((ad: Ad) => ad.id === adToDelete);

  const confirmDelete = async (reason?: string) => {
    if (adToDelete) {
      try {
        await deleteAd({
          variables: { id: adToDelete, reason: reason || null }
        });
        addToast({
          type: 'success',
          title: 'Ad Deleted',
          message: `Ad ${adToDelete} deleted successfully!`,
          duration: 4000
        });
        setShowDeleteModal(false);
        setAdToDelete(null);
      } catch (error) {
        console.error('Error deleting ad:', error);
        addToast({
          type: 'error',
          title: 'Deletion Failed',
          message: `Failed to delete ad: ${error instanceof Error ? error.message : 'Unknown error'}`,
          duration: 6000
        });
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setAdToDelete(null);
  };

  // Bulk action handlers
  const handleAdSelect = (id: string) => {
    setSelectedAds(prev =>
      prev.includes(id)
        ? prev.filter(adId => adId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAllAds = () => {
    const currentPageIds = paginatedAds.map((ad: Ad) => ad.id);
    const allCurrentPageSelected = currentPageIds.every(id => selectedAds.includes(id));
    
    if (allCurrentPageSelected) {
      // Deselect only items from current page
      setSelectedAds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Add current page items to existing selection
      setSelectedAds(prev => {
        const newSelection = [...prev];
        currentPageIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedAds.length === 0) return;

    try {
      await Promise.all(
        selectedAds.map(id =>
          updateAd({
            variables: {
              id,
              input: {
                status: 'APPROVED'
              }
            }
          })
        )
      );
      addToast({
        type: 'success',
        title: 'Success!',
        message: `${selectedAds.length} advertisement(s) approved successfully`,
        duration: 5000
      });
      setSelectedAds([]);
    } catch (error) {
      console.error('Error bulk approving ads:', error);
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Failed to approve some advertisements',
        duration: 5000
      });
    }
  };

  const handleBulkReject = () => {
    if (selectedAds.length === 0) return;
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

    try {
      await Promise.all(
        selectedAds.map(id =>
          updateAd({
            variables: {
              id,
              input: {
                status: 'REJECTED',
                reasonForReject: bulkRejectReason
              }
            }
          })
        )
      );
      addToast({
        type: 'success',
        title: 'Success!',
        message: `${selectedAds.length} advertisement(s) rejected successfully`,
        duration: 5000
      });
      setShowBulkRejectModal(false);
      setBulkRejectReason('');
      setSelectedAds([]);
    } catch (error) {
      console.error('Error bulk rejecting ads:', error);
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Failed to reject some advertisements',
        duration: 5000
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAds.length === 0) return;

    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await Promise.all(
        selectedAds.map(id =>
          deleteAd({
            variables: { id }
          })
        )
      );
      addToast({
        type: 'success',
        title: 'Success!',
        message: `${selectedAds.length} advertisement(s) deleted successfully`,
        duration: 5000
      });
      setSelectedAds([]);
    } catch (error) {
      console.error('Error bulk deleting ads:', error);
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Failed to delete some advertisements',
        duration: 5000
      });
    } finally {
      setShowBulkDeleteModal(false);
    }
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteModal(false);
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatusFilter(status);
    setShowStatusDropdown(false);
  };

  // Date filter handlers
  const handleApplyDateFilter = (filter: {
    startDate: Date | null;
    endDate: Date | null;
    condition: string;
  }) => {
    setDateFilter(filter);
  };

  const handleDeleteDateFilter = () => {
    setDateFilter(null);
  };

  // Calendar widget handlers
  const handleCalendarDateSelect = (date: Date | null) => {
    setCalendarSelectedDate(date);
    if (date) {
      setDateFilter({
        startDate: date,
        endDate: null,
        condition: 'Is'
      });
    } else {
      setDateFilter(null);
    }
  };

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  const formatDateRange = (): string => {
    if (!dateFilter) return '';
    if (dateFilter.startDate && dateFilter.endDate) {
      return `${dateFilter.startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} - ${dateFilter.endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    return dateFilter.startDate ? dateFilter.startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  };


  const handleRowClick = (ad: Ad) => {
    handleViewAdDetails(ad);
    setShowAdDetailsModal(true);
  };

  // Tab management functions
  const tabs = [
    { id: 'ads', label: 'All Ads'},
    { id: 'archived', label: 'Deleted Ads'},
    { id: 'schedule', label: 'Schedule'},
    { id: 'deployment', label: 'Deployment'},
    { id: 'company-ads', label: 'Company Ads'}
  ];

  // Filter and sort functions
  const filteredAds = (data?.getAllAds?.filter((ad: Ad) => {
    // Filter by archive status based on active tab
    const isArchivedMatch = activeTab === 'archived' ? ad.isArchived === true : ad.isArchived !== true;
    
    if (!isArchivedMatch) return false;

    const matchesSearch =
      ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ad.userId?.firstName && ad.userId?.lastName && `${ad.userId.firstName} ${ad.userId.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ad.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = adsStatusFilter === 'All Status' || ad.status.toLowerCase() === adsStatusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  }) || []).sort((a: Ad, b: Ad) => {
    switch (selectedSortBy) {
      case 'Newest First':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'Oldest First':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'Start Date (Newest)':
        const aStart = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bStart = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bStart - aStart;
      case 'End Date (Soonest)':
        const aEnd = a.endDate ? new Date(a.endDate).getTime() : Infinity;
        const bEnd = b.endDate ? new Date(b.endDate).getTime() : Infinity;
        return aEnd - bEnd;
      case 'Alphabetical (A-Z)':
        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
      case 'Alphabetical (Z-A)':
        return b.title.toLowerCase().localeCompare(a.title.toLowerCase());
      default:
        return 0;
    }
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAds.length / itemsPerPage);
  const paginatedAds = filteredAds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (error) {
    return (
      <div className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-10 transition-all duration-300`}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error loading ads: </strong>
          <span className="block sm:inline">{error.message}</span>
          <button
            onClick={() => refetch()}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-100 ${isMobile ? 'ml-0 pt-16' : 'ml-0 md:ml-16 lg:ml-60'} md:pr-5 p-4 md:p-10 flex flex-col transition-all duration-300`}>
      {/* Header with Title and Filters */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-3 gap-3">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 md:pt-0">Advertisements Management</h1>
        {(activeTab === 'ads' || activeTab === 'archived') && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by title, advertiser, or Ad ID..."
              className="text-xs text-black rounded-md pl-3 md:pl-5 py-3 w-full md:w-80 shadow-md focus:outline-none bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      {/* Tabs - Dropdown on Mobile, Horizontal on Desktop */}
      {isMobile ? (
        <div className="relative w-32" ref={tabsDropdownRef}>
          <button
            onClick={() => setShowTabsDropdown(!showTabsDropdown)}
            className="flex items-center justify-between w-full text-xs text-black rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none bg-white gap-2"
          >
            <span className="truncate">
              {tabs.find(tab => tab.id === activeTab)?.label || 'Select Tab'}
            </span>
            <ChevronDown
              size={16}
              className={`flex-shrink-0 transform transition-transform duration-200 ${
                showTabsDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {showTabsDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setShowTabsDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150 ${
                      activeTab === tab.id ? 'bg-[#3674B5] text-white' : ''
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <nav className="flex overflow-x-auto space-x-2 pb-2 md:pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center py-3 md:py-4 px-2 md:px-2 font-medium text-xs md:text-sm transition-colors group whitespace-nowrap ${
                activeTab === tab.id ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                  ${activeTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}
                `}
              />
            </button>
          ))}
        </nav>
      )}

      {/* Filters on the right */}
      {['ads', 'schedule', 'deployment'].includes(activeTab) && (
        <div className="flex flex-col items-end gap-2">
          {/* Top row: Calendar and All Status */}
          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-2">
            {/* Calendar Widget for schedule tab */}
            {activeTab === 'schedule' && (
              <div className="relative   calendar-container">
                <button
                  onClick={toggleCalendar}
                  className="px-4 py-3 shadow-md text-xs bg-white text-black rounded-md flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {calendarSelectedDate 
                    ? calendarSelectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'Date'
                  }
                </button>
                
                {/* Calendar Dropdown */}
                {showCalendar && (
                  <>
                    {/* Mobile: Fixed centered overlay */}
                    <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
                      <div className="bg-white rounded-lg shadow-xl">
                        <CalendarWidget
                          selectedDate={calendarSelectedDate}
                          onDateSelect={(date) => {
                            handleCalendarDateSelect(date);
                            setShowCalendar(false);
                          }}
                          className="w-full"
                        />
                      </div>
                    </div>
                    {/* Desktop: Dropdown */}
                    <div className="hidden md:block absolute top-full right-0 mt-2 z-[9999]">
                      <CalendarWidget
                        selectedDate={calendarSelectedDate}
                        onDateSelect={(date) => {
                          handleCalendarDateSelect(date);
                          setShowCalendar(false);
                        }}
                        className="w-80"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* All Status Filter */}
            <div className="relative w-32 md:w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                {activeTab === 'ads'
                  ? adsStatusFilter
                  : activeTab === 'schedule'
                  ? scheduleStatusFilter
                  : deploymentStatusFilter}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : 'rotate-0'}`}
                />
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
                    {(activeTab === 'deployment' ? deploymentStatusFilterOptions : statusFilterOptions).map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          if (activeTab === 'ads') setAdsStatusFilter(status);
                          else if (activeTab === 'schedule') setScheduleStatusFilter(status);
                          else if (activeTab === 'deployment') setDeploymentStatusFilter(status);
                          setShowStatusDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                      >
                        {status}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sort By Filter - Only for Ads tab */}
            {activeTab === 'ads' && (
              <div className="relative w-36 md:w-48">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                >
                  <span className="truncate">{selectedSortBy}</span>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transform transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : 'rotate-0'}`}
                  />
                </button>

                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden max-h-60 overflow-y-auto"
                    >
                      {sortByOptions.map((sortOption) => (
                        <button
                          key={sortOption}
                          onClick={() => {
                            setSelectedSortBy(sortOption);
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
            )}
          </div>
          
          {/* Bottom row: Refresh button */}
          <div className='flex justify-end'>
          <button
            onClick={() => window.location.reload()}
            className="px-3 md:px-4 py-2 text-xs md:text-sm font-semibold bg-[#3674B5] text-white rounded-md hover:shadow-md flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <RefreshCw className="w-4 h-4" />
            {isMobile ? 'Refresh' : 'Refresh'}
          </button>
          </div>
        </div>
      )}
    </div>



      {/* Tab Content */}
      <div className="flex-1 flex flex-col">
        {/* All Ads Tab */}
        {(activeTab === 'ads' || activeTab === 'archived') && (
          <div className="flex-1 flex flex-col">
            {/* Stats Summary - Only show for All Ads tab */}
            {activeTab === 'ads' && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
              <div className="bg-white p-3 md:p-4 rounded-md">
                <p className="text-2xl md:text-3xl text-center font-bold text-gray-900">{data?.getAllAds?.length || 0}</p>
                <h3 className="text-xs md:text-sm text-center font-medium text-gray-500">Total Advertisement</h3>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-md">
                <p className="text-2xl md:text-3xl text-center font-bold text-blue-500">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'RUNNING').length || 0}
                </p>
                <h3 className="text-xs md:text-sm text-center font-medium text-gray-500">Running</h3>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-md">
                <p className="text-2xl md:text-3xl text-center font-bold text-green-600">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'APPROVED').length || 0}
                </p>
                <h3 className="text-xs md:text-sm text-center font-medium text-gray-500">Approved</h3>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-md">
                <p className="text-2xl md:text-3xl text-center font-bold text-yellow-500">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'PENDING').length || 0}
                </p>
                <h3 className="text-xs md:text-sm text-center font-medium text-gray-500">Pending</h3>
              </div>
              <div className="bg-white p-3 md:p-4 rounded-md col-span-2 md:col-span-1">
                <p className="text-2xl md:text-3xl text-center font-bold text-purple-600">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'SCHEDULED').length || 0}
                </p>
                <h3 className="text-xs md:text-sm text-center font-medium text-gray-500">Scheduled</h3>
              </div>
              </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedAds.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 md:p-4 mb-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <span className="text-xs md:text-sm font-medium text-blue-800">
                      {selectedAds.length} advertisement{selectedAds.length > 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setSelectedAds([])}
                      className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium self-start md:self-auto"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filteredAds.filter((ad: Ad) => selectedAds.includes(ad.id) && ad.status === 'PENDING').length > 0 && (
                      <>
                        <button
                          onClick={handleBulkApprove}
                          className="px-3 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200 flex-1 md:flex-none"
                        >
                          Approve Selected
                        </button>
                        <button
                          onClick={handleBulkReject}
                          className="px-3 py-1.5 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200 flex-1 md:flex-none"
                        >
                          Reject Selected
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-medium rounded hover:bg-gray-200 flex-1 md:flex-none"
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table/Cards */}
            {loading ? (
              <AdminLoader />
            ) : filteredAds.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                {searchTerm !== 'all' ? 'No ads match your search criteria' : 'No ads found'}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block rounded-md mb-4 overflow-hidden">
                  <div className="grid grid-cols-12 px-4 py-3 text-sm font-semibold text-gray-600">
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                          checked={paginatedAds.length > 0 && paginatedAds.every((ad: Ad) => selectedAds.includes(ad.id))}
                          onChange={handleSelectAllAds}
                        />
                        <AnimatePresence>
                          {paginatedAds.length > 0 && paginatedAds.every((ad: Ad) => selectedAds.includes(ad.id)) && (
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
                      <span className="cursor-pointer" onClick={handleSelectAllAds}>Title</span>
                    </div>
                    <div className="col-span-3">Advertiser</div>
                    <div className="col-span-2">Ad Type</div>
                    {activeTab === 'archived' ? (
                      <>
                        <div className="col-span-1">Status</div>
                        <div className="col-span-3">Deletion Date</div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2 text-center">Actions</div>
                      </>
                    )}
                  </div>

                  {paginatedAds.map((ad: Ad) => (
                    <div key={ad.id} className="bg-white mb-3 rounded-md shadow-md">
                      <div
                        className="grid grid-cols-12 items-center px-5 py-4 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(ad)}
                      >
                        <div className="col-span-3 flex items-center gap-2">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              className="appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                              checked={selectedAds.includes(ad.id)}
                              onChange={() => handleAdSelect(ad.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <AnimatePresence>
                              {selectedAds.includes(ad.id) && (
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
                          <span className="truncate" title={ad.title}>{ad.title}</span>
                        </div>
                        <div className="col-span-3 truncate" title={getAdvertiserName(ad.userId)}>
                          {getAdvertiserName(ad.userId)}
                        </div>
                        <div className="col-span-2">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {ad.adType}
                          </span>
                        </div>
                        {activeTab === 'archived' ? (
                          <>
                            <div className="col-span-1">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  ad.status === 'APPROVED'
                                    ? 'bg-green-200 text-green-800'
                                    : ad.status === 'PENDING'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : ad.status === 'REJECTED'
                                    ? 'bg-red-200 text-red-800'
                                    : ad.status === 'RUNNING'
                                    ? 'bg-blue-200 text-blue-800'
                                    : ad.status === 'ARCHIVED'
                                    ? 'bg-red-200 text-red-800'
                                    : 'bg-gray-200 text-gray-800'
                                }`}
                              >
                                {ad.status === 'ARCHIVED' ? 'Deleted' : ad.status}
                              </span>
                            </div>
                            <div className="col-span-3 text-sm text-red-600 font-medium">
                              {ad.scheduledDeletionDate ? formatDate(ad.scheduledDeletionDate) : 'N/A'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  ad.status === 'APPROVED'
                                    ? 'bg-green-200 text-green-800'
                                    : ad.status === 'PENDING'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : ad.status === 'REJECTED'
                                    ? 'bg-red-200 text-red-800'
                                    : ad.status === 'RUNNING'
                                    ? 'bg-blue-200 text-blue-800'
                                    : ad.status === 'ARCHIVED'
                                    ? 'bg-red-200 text-red-800'
                                    : 'bg-gray-200 text-gray-800'
                                }`}
                              >
                                {ad.status === 'ARCHIVED' ? 'Deleted' : ad.status}
                              </span>
                            </div>
                            <div className="col-span-2 flex items-center justify-center gap-1">
                              {ad.status === 'PENDING' && ( <>
                                {/* APPROVE BUTTON */}
                                <button
                                  className={`group flex items-center rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-20 transition-[width] duration-300 ${
                                    processingApprove.has(ad.id)
                                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                      : 'bg-green-200 hover:bg-green-200 text-green-700'
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); handleApprove(ad.id); }}
                                  disabled={processingApprove.has(ad.id)}
                                  title={processingApprove.has(ad.id) ? "Processing..." : "Approve"}
                                >
                                  {processingApprove.has(ad.id) ? (
                                    <div className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                                  ) : (
                                    <Check className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                                  )}
                                  <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                                    {processingApprove.has(ad.id) ? 'Processing...' : 'Approve'}
                                  </span>
                                </button>

                                {/* REJECT BUTTON */}
                                <button
                                  className={`group flex items-center rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-16 transition-[width] duration-300 ${
                                    processingReject.has(ad.id)
                                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                      : 'bg-red-200 hover:bg-red-200 text-red-700'
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); handleReject(ad.id); }}
                                  disabled={processingReject.has(ad.id)}
                                  title={processingReject.has(ad.id) ? "Processing..." : "Reject"}
                                >
                                  {processingReject.has(ad.id) ? (
                                    <div className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                                  ) : (
                                    <X className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                                  )}
                                  <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 text-xs whitespace-nowrap transition-all duration-300">
                                    {processingReject.has(ad.id) ? 'Processing...' : 'Reject'}
                                  </span>
                                </button>
                                </> 
                              )}
                              <button
                                className="group flex items-center text-red-700 overflow-hidden h-8 w-7 hover:w-20 transition-[width] duration-300"
                                onClick={(e) => { e.stopPropagation(); handleDelete(ad.id); }}
                                title="Delete"
                              >
                                <Trash 
                                  className="flex-shrink-0 mx-auto mr-1 group-hover:ml-1.5 transition-all duration-300"
                                  size={16} />
                                <span className="opacity-0 group-hover:opacity-100 text-xs group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                                  Delete
                                </span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3 mb-4">
                  {paginatedAds.map((ad: Ad) => (
                    <div key={ad.id} className="bg-white rounded-md shadow-md p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="relative flex items-center justify-center mt-1">
                          <input
                            type="checkbox"
                            className="appearance-none w-4 h-4 border border-gray-300 rounded bg-white cursor-pointer"
                            checked={selectedAds.includes(ad.id)}
                            onChange={() => handleAdSelect(ad.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <AnimatePresence>
                            {selectedAds.includes(ad.id) && (
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
                        <div className="flex-1" onClick={() => handleRowClick(ad)}>
                          <h3 className="font-semibold text-gray-900 mb-1">{ad.title}</h3>
                          <p className="text-xs text-gray-600 mb-2">{getAdvertiserName(ad.userId)}</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {ad.adType}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                ad.status === 'APPROVED'
                                  ? 'bg-green-200 text-green-800'
                                  : ad.status === 'PENDING'
                                  ? 'bg-yellow-200 text-yellow-800'
                                  : ad.status === 'REJECTED'
                                  ? 'bg-red-200 text-red-800'
                                  : ad.status === 'RUNNING'
                                  ? 'bg-blue-200 text-blue-800'
                                  : ad.status === 'ARCHIVED'
                                  ? 'bg-red-200 text-red-800'
                                  : 'bg-gray-200 text-gray-800'
                              }`}
                            >
                              {ad.status === 'ARCHIVED' ? 'Deleted' : ad.status}
                            </span>
                          </div>
                          {activeTab === 'archived' && ad.scheduledDeletionDate && (
                            <p className="text-xs text-red-600 font-medium mb-2">
                              Deletion: {formatDate(ad.scheduledDeletionDate)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Mobile Actions */}
                      <div className="flex justify-end gap-1 pt-3 flex-wrap">
                        {activeTab !== 'archived' && (
                          <>
                            {ad.status === 'PENDING' && (
                              <>
                                <button
                                  className={`px-2 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1 ${
                                    processingApprove.has(ad.id)
                                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(ad.id);
                                  }}
                                  disabled={processingApprove.has(ad.id)}
                                >
                                  {processingApprove.has(ad.id) ? (
                                    <div className="w-3 h-3 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                  {processingApprove.has(ad.id) ? '' : ''}
                                </button>

                                <button
                                  className={`px-2 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1 ${
                                    processingReject.has(ad.id)
                                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(ad.id);
                                  }}
                                  disabled={processingReject.has(ad.id)}
                                >
                                  {processingReject.has(ad.id) ? (
                                    <div className="w-3 h-3 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                                  ) : (
                                    <X size={14} />
                                  )}
                                  {processingReject.has(ad.id) ? '' : ''}
                                </button>
                              </>
                            )}

                            {/* Always visible Delete button */}
                            <button
                            className="flex items-center text-red-700 px-1 py-1 rounded hover:bg-red-50"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(ad.id);
                              }}
                            >
                              <Trash size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination Controls */}
            {!loading && filteredAds.length > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-center px-2 md:px-4 py-4 gap-3 mt-auto">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="flex items-center px-2 md:px-3 py-1 text-xs md:text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 md:mr-1" />
                    <span className="hidden md:inline">Previous</span>
                  </button>

                  <div className="flex gap-1">
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = isMobile ? 3 : 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                      if (endPage - startPage < maxVisiblePages - 1) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => handlePageChange(i)}
                            className={`px-2 md:px-3 py-1 text-xs md:text-sm rounded ${
                              currentPage === i
                                ? "border border-gray-300 text-black"
                                : "text-gray-700 hover:border border-gray-300"
                            }`}
                          >
                            {i}
                          </button>
                        );
                      }

                      if (endPage < totalPages) {
                        pages.push(
                          <span key="ellipsis" className="px-1 md:px-2 text-gray-500">
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
                    className="flex items-center px-2 md:px-3 py-1 text-xs md:text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="hidden md:inline">Next</span>
                    <ChevronRight className="w-4 h-4 md:ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <ScheduleTab
            statusFilter={scheduleStatusFilter}
            onStatusChange={setScheduleStatusFilter}
            dateFilter={dateFilter}
          />
        )}
        {activeTab === 'deployment' && (
          <DeploymentTab
            statusFilter={deploymentStatusFilter}
            onStatusChange={setDeploymentStatusFilter}
            onDeleteAd={(adId, adTitle) => {
              // Navigate to All Ads tab
              setActiveTab('ads');
              // Set the ad to delete (this will trigger the delete modal with validation)
              setAdToDelete(adId);
              setShowDeleteModal(true);
            }}
          />
        )}
        {activeTab === 'company-ads' && (
          <CompanyAdsManagement />
        )}
      </div>

      {/* Ad Details Modal */}
      {showAdDetailsModal && selectedAd && (
        <div
          className="fixed inset-0 z-[9999] overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleCloseAdModal} // closes the modal on outside click
        >
          <div
            className={`fixed md:top-2 md:bottom-2 md:right-2 inset-0 md:inset-auto md:max-w-2xl w-full bg-white shadow-xl md:rounded-md transform transition-transform duration-300 ease-in-out ${
              isAdModalOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()} // stops click from closing modal
          >
            <div className="h-full p-4 md:p-6 overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-3xl font-bold text-white bg-[#FF9D3D] mr-3 md:mr-4 shadow-md">
                    {selectedAd.userId?.firstName ? selectedAd.userId.firstName[0] : 'U'}
                    {selectedAd.userId?.lastName ? selectedAd.userId.lastName[0] : 'N'}
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h2 className="text-lg md:text-2xl font-bold text-gray-800">{getAdvertiserName(selectedAd.userId)}</h2>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          selectedAd.status === 'APPROVED'
                            ? 'bg-green-200 text-green-800'
                            : selectedAd.status === 'PENDING'
                            ? 'bg-yellow-200 text-yellow-800'
                            : selectedAd.status === 'REJECTED'
                            ? 'bg-red-200 text-red-800'
                            : selectedAd.status === 'RUNNING'
                            ? 'bg-blue-200 text-blue-800'
                            : selectedAd.status === 'ARCHIVED'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >  
                        {selectedAd.status === 'ARCHIVED' ? 'Deleted' : selectedAd.status}
                      </span>

                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-200 text-blue-800">{selectedAd.adType}</span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedAd.id}</p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                {/* Media Preview */}
                <div className="flex flex-col space-y-4">
                  {selectedAd.mediaFile ? (
                    selectedAd.adFormat === 'IMAGE' ? (
                      <img
                        src={selectedAd.mediaFile}
                        alt="Ad media"
                        className="w-full h-64 object-contain bg-gray-100 rounded-md shadow-md"
                        onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;base64,...'; }}
                      />
                    ) : selectedAd.adFormat === 'VIDEO' ? (
                      <video controls className="w-full h-64 bg-gray-100 rounded-md shadow-md">
                        <source src={selectedAd.mediaFile} />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-100 rounded-md">Media not available</div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-100 rounded-md">Media not available</div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col space-y-3 md:space-y-4">
                  <h3 className="text-xl md:text-3xl mt-2 font-bold text-[#1B5087]">{selectedAd.title || 'N/A'}</h3>
                  <p className="text-gray-600 pb-8 md:pb-16 text-xs md:text-sm">{selectedAd.description || 'No description provided'}</p>
                  <div className="flex items-center space-x-3">
                  <Tablet size={24} className="text-gray-500" />
                    <span className="truncate">
                      {Array.isArray(selectedAd.materialId) 
                        ? (selectedAd.materialId[0]?.materialType || 'N/A')
                        : (selectedAd.materialId?.materialType || 'N/A')
                      }
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Coins size={24} className="text-gray-500" />
                    <span className="font-semibold text-lg text-[#FF9B45]">{formatCurrency(selectedAd.price)}</span>
                  </div>
                </div>
              </div>

              {/* Campaign Details */}
              <div className="mt-6 md:mt-10">
                <h4 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Campaign Details</h4>
                <div className="mt-3 md:mt-4 pt-3 md:pt-4 grid grid-cols-1 md:grid-cols-2 gap-y-3 md:gap-y-4 md:gap-x-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                    <CalendarRange size={20} className="text-yellow-600" />
                    <p className='text-black'>{selectedAd.durationDays} Days</p>
                    </div>
                    <div className="flex items-center space-x-3">
                    <CalendarClock size={20} className="text-green-500" />
                    <p className='text-black'>{formatDate(selectedAd.startTime)}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                    <CalendarX2 size={20} className="text-red-500" />
                    <p className='text-black'>{formatDate(selectedAd.endTime)}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                    <Mail size={20} className="text-gray-500" />
                    <p className='text-black'>{selectedAd.userId?.email}</p>
                    </div>
                    {/* Show "Approved by" if ad is approved (takes highest priority) */}
                    {(selectedAd.approvedBy && selectedAd.approvedBy.firstName) ? (
                      <div className="flex items-center space-x-3">
                        <CheckCircle size={20} className="text-green-500" />
                        <p className='text-black'>Approved by: <span className="font-semibold">{getAdminName(selectedAd.approvedBy)}</span></p>
                      </div>
                    ) : selectedAd.status === 'APPROVED' && selectedAd.approveTime ? (
                      <div className="flex items-center space-x-3">
                        <CheckCircle size={20} className="text-green-500" />
                        <p className='text-black text-gray-500 italic'>Approved by: <span className="font-semibold">Admin (archived)</span></p>
                      </div>
                    ) : null}
                    {/* Show "Rejected by" if ad is rejected (only if not approved) */}
                    {selectedAd.status !== 'APPROVED' && (selectedAd.rejectedBy && selectedAd.rejectedBy.firstName) ? (
                      <div className="flex items-center space-x-3">
                        <XCircle size={20} className="text-red-500" />
                        <p className='text-black'>Rejected by: <span className="font-semibold">{getAdminName(selectedAd.rejectedBy)}</span></p>
                      </div>
                    ) : selectedAd.status === 'REJECTED' && selectedAd.rejectTime && selectedAd.status !== 'APPROVED' ? (
                      <div className="flex items-center space-x-3">
                        <XCircle size={20} className="text-red-500" />
                        <p className='text-black text-gray-500 italic'>Rejected by: <span className="font-semibold">Admin (archived)</span></p>
                      </div>
                    ) : null}
                    {/* Show "Restored by" or "Deleted by" only if ad is not approved */}
                    {selectedAd.status !== 'APPROVED' && (
                      <>
                        {/* Show "Restored by" if ad was restored (takes priority over "Deleted by") */}
                        {(selectedAd.restoredBy && selectedAd.restoredBy.firstName) ? (
                          <div className="flex items-center space-x-3">
                            <RotateCcw size={20} className="text-blue-500" />
                            <p className='text-black'>Restored by: <span className="font-semibold">{getAdminName(selectedAd.restoredBy)}</span></p>
                          </div>
                        ) : (selectedAd.deletedBy && selectedAd.deletedBy.firstName) ? (
                          <div className="flex items-center space-x-3">
                            <Trash size={20} className="text-red-600" />
                            <p className='text-black'>Deleted by: <span className="font-semibold">{getAdminName(selectedAd.deletedBy)}</span></p>
                          </div>
                        ) : selectedAd.isArchived && selectedAd.archivedAt ? (
                          <div className="flex items-center space-x-3">
                            <Trash size={20} className="text-red-600" />
                            <p className='text-black text-gray-500 italic'>Deleted by: <span className="font-semibold">Admin (archived or unknown)</span></p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="space-y-2 border-l border-gray-300 md:border-none md:pr-10 md:pt-0 pt-4">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">Devices:</span>
                      <span>{selectedAd.numberOfDevices}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold text-gray-800">Plays/Day:</span>
                      <span>{selectedAd.totalPlaysPerDay}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold text-gray-800">Format:</span>
                      <span>{selectedAd.adFormat}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="mt-6 md:mt-8 border-t pt-4 md:pt-6">
                <h4 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Payment Status</h4>
                <div className="flex flex-col space-y-2 text-sm text-black font-semibold">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                    <span>Created: {selectedAd.createdAt ? formatDate(selectedAd.createdAt) : 'N/A'}</span>
                  </div>
                  {selectedAd.status === 'REJECTED' ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <span>Ad Rejected - No Payment Required</span>
                    </div>
                  ) : selectedAd.status === 'ARCHIVED' ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <span>Ad Deleted - No Payment Required</span>
                    </div>
                  ) : selectedAd.paymentStatus === 'PAID' ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <span>Payment Paid</span>
                    </div>
                  ) : selectedAd.paymentStatus === 'FAILED' ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <span>Payment Failed</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <span>Pending Payment</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl p-4 md:p-6 max-w-md w-full shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                Reject Advertisement
              </h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={22} />
              </button>
            </div>

            {/* Textarea */}
            <div className="relative mb-7">
              <textarea
                id="rejectReason"
                name="rejectReason"
                required
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  // 🔹 Auto-expand
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; // smoother max
                }}
                placeholder="Reason for rejection"
                className="peer w-full px-1 pb-3 pt-3 border-b border-gray-300
                    focus:outline-none focus:border-blue-500 placeholder-transparent transition"
                />

              {/* Floating label */}
              <label
                htmlFor="rejectReason"
                className={`absolute left-0 pb-3 w-full text-gray-500 text-sm transition-all duration-200
                  pointer-events-none bg-transparent px-1
                  ${
                    rejectReason
                      ? "text-xs -top-3.5 font-medium"
                      : "peer-placeholder-shown:top-10 peer-placeholder-shown:text-gray-500 peer-placeholder-shown:text-sm"
                  }
                  peer-focus:-top-3.5 peer-focus:text-xs peer-focus:font-medium
                `}
              >
                Reason for rejection
              </label>

              <p className="mt-2 text-xs text-[#3674B5]">
                This reason will be visible to the advertiser.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-between">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={
                  !rejectReason.trim() ||
                  (adToReject ? processingReject.has(adToReject) : false)
                }
                className={`px-4 py-2 rounded-md transition-all flex items-center gap-2
                  ${
                    !rejectReason.trim() ||
                    (adToReject ? processingReject.has(adToReject) : false)
                      ? 'bg-gray-200 text-black/70 cursor-not-allowed'
                      : 'bg-red-200 text-red-700 hover:shadow-md'
                  }`}
              >
                {adToReject && processingReject.has(adToReject) && (
                  <div className="w-4 h-4 animate-spin text-black/60 border-2 border-black/60 border-t-transparent rounded-full" />
                )}
                {adToReject && processingReject.has(adToReject)
                  ? 'Processing...'
                  : 'Reject Advertisement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {showBulkRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-md p-4 md:p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 mb-5">Reject {selectedAds.length} Advertisement(s)</h2>
              <button
                onClick={() => {
                  setShowBulkRejectModal(false);
                  setBulkRejectReason('');
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
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

              <p className="mt-1 text-xs text-gray-500">This reason will be visible to all selected advertisers.</p>
            </div>

            <div className="flex gap-3 justify-between">
              <button
                onClick={() => {
                  setShowBulkRejectModal(false);
                  setBulkRejectReason('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitBulkReject}
                disabled={!bulkRejectReason.trim()}
                className={`px-4 py-2 text-white rounded transition-colors ${
                  !bulkRejectReason.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Reject {selectedAds.length} Advertisement{selectedAds.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Advertisement"
        message={
          adBeingDeleted?.status === 'RUNNING' || adBeingDeleted?.status === 'APPROVED' || adBeingDeleted?.status === 'SCHEDULED'
            ? "Are you sure you want to delete this running advertisement? This action cannot be undone and the ad will be immediately removed from all devices."
            : "Are you sure you want to delete this ad? This action cannot be undone."
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        requireTitleConfirmation={true}
        confirmationTitle={adBeingDeleted?.title || ''}
        requireReason={true}
      />


      {/* Date Filter Modal */}
      <DateFilter
        isOpen={showDateFilterModal}
        onClose={() => setShowDateFilterModal(false)}
        onApplyFilter={handleApplyDateFilter}
        onDeleteFilter={handleDeleteDateFilter}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteModal}
        onClose={cancelBulkDelete}
        onConfirm={confirmBulkDelete}
        title="Delete Advertisements"
        message={`Are you sure you want to delete ${selectedAds.length} advertisement(s)? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default ManageAds;