import React, { useState } from 'react';
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
  BarChart3,
  ChevronDown,
  Check,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../../components/ConfirmationModal';

import {
  GET_ALL_ADS,
  UPDATE_AD,
  DELETE_AD,
  type Ad,
  type User
} from '../../graphql/admin/ads';
import ScheduleTab from './tabs/manageAds/ScheduleTab';
import DeploymentTab from './tabs/manageAds/DeploymentTab';
import PlanAvailabilityTab from './tabs/manageAds/PlanAvailabilityTab';
import DateFilter from '../../components/DateFilter';

const ManageAds: React.FC = () => {
  const { admin, isLoading, isInitialized } = useAdminAuth();
  
  // Tab management
  const [activeTab, setActiveTab] = useState<'ads' | 'schedule' | 'deployment' | 'availability'>('ads');
  
  // Existing state
  const [searchTerm, setSearchTerm] = useState('');
  // Status filter options
  const statusFilterOptions = ['All Status', 'Approved', 'Pending', 'Running', 'Rejected'];
  const deploymentStatusFilterOptions = ['All Status', 'RUNNING', 'SCHEDULED', 'COMPLETED', 'PAUSED'];

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All Status');
  const [showAdDetailsModal, setShowAdDetailsModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adToReject, setAdToReject] = useState<string | null>(null);
  const [showRejectionNotification, setShowRejectionNotification] = useState(true);

  // Loading states for approve/reject buttons
  const [processingAds, setProcessingAds] = useState<Set<string>>(new Set());

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

  const [adsStatusFilter, setAdsStatusFilter] = useState('All Status');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('All Status');
  const [deploymentStatusFilter, setDeploymentStatusFilter] = useState('All Status');
  
  // Date filter state for schedule tab
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState<{
    startDate: Date | null;
    endDate: Date | null;
    condition: string;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adToDelete, setAdToDelete] = useState<string | null>(null);

  


  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const handleViewAdDetails = (ad: Ad) => {
  setSelectedAd(ad);
  setShowAdDetailsModal(true);

  // Trigger slide-in animation after modal is rendered
  setTimeout(() => {
    setIsAdModalOpen(true);
  }, 10);
  if (ad.status === 'REJECTED') {
    setShowRejectionNotification(true);
  }
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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


  const formatDate = (date: string) => {
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

  // Actions
  const handleApprove = async (adId: string) => {
    // Prevent multiple clicks
    if (processingAds.has(adId)) {
      return;
    }

    // Add to processing set
    setProcessingAds(prev => new Set(prev).add(adId));

    try {
      await updateAd({
        variables: {
          id: adId,
          input: {
            status: 'APPROVED'
          }
        }
      });
      addToast({
        type: 'success',
        title: 'Ad Approved',
        message: `Ad ${adId} approved successfully!`,
        duration: 4000
      });
    } catch (error) {
      console.error('Error approving ad:', error);
      addToast({
        type: 'error',
        title: 'Approval Failed',
        message: `Failed to approve ad: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 6000
      });
    } finally {
      // Remove from processing set
      setProcessingAds(prev => {
        const newSet = new Set(prev);
        newSet.delete(adId);
        return newSet;
      });
    }
  };

  const handleReject = (adId: string) => {
    setAdToReject(adId);
    setShowRejectModal(true);
  };

  const submitReject = async () => {
    if (!adToReject || !rejectReason.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide a reason for rejection',
        duration: 4000
      });
      return;
    }

    // Prevent multiple clicks
    if (processingAds.has(adToReject)) {
      return;
    }

    // Add to processing set
    setProcessingAds(prev => new Set(prev).add(adToReject));

    try {
      await updateAd({
        variables: {
          id: adToReject,
          input: {
            status: 'REJECTED',
            reasonForReject: rejectReason
          }
        }
      });
      addToast({
        type: 'success',
        title: 'Ad Rejected',
        message: `Ad ${adToReject} rejected successfully!`,
        duration: 4000
      });
      setShowRejectModal(false);
      setRejectReason('');
      setAdToReject(null);
    } catch (error) {
      console.error('Error rejecting ad:', error);
      addToast({
        type: 'error',
        title: 'Rejection Failed',
        message: `Failed to reject ad: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 6000
      });
    } finally {
      // Remove from processing set
      setProcessingAds(prev => {
        const newSet = new Set(prev);
        newSet.delete(adToReject);
        return newSet;
      });
    }
  };

  const handleDelete = (adId: string) => {
    setAdToDelete(adId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (adToDelete) {
      try {
        await deleteAd({
          variables: { id: adToDelete }
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
    { id: 'ads', label: 'All Ads', icon: Monitor },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'deployment', label: 'Deployment', icon: PlayCircle },
    { id: 'availability', label: 'Material Slot Checker', icon: CalendarRange }
  ];

  // Filter functions
  const filteredAds = data?.getAllAds?.filter((ad: Ad) => {
    const matchesSearch =
      ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ad.userId?.firstName && ad.userId?.lastName && `${ad.userId.firstName} ${ad.userId.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      ad.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = adsStatusFilter === 'All Status' || ad.status.toLowerCase() === adsStatusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  }) || [];


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg text-gray-600">Loading advertisements...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
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
        <h1 className="text-3xl font-bold text-gray-800">Advertisements Management</h1>
        {activeTab === 'ads' && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by title, advertiser, or Ad ID..."
              className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mb-6 flex justify-between items-center">
      {/* Tabs */}
      <nav className="flex space-x-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`relative flex items-center py-4 px-1 font-medium text-sm transition-colors group ${
              activeTab === tab.id ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
            <span
              className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                ${activeTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}
              `}
            />
          </button>
        ))}
      </nav>

      {/* Filters on the right */}
      {['ads', 'schedule', 'deployment'].includes(activeTab) && (
        <div className="flex flex-col items-end gap-2">
          {/* Top row: Add Filter and All Status */}
          <div className="flex items-center gap-3">
            {/* Add Filter button for schedule tab */}
            {activeTab === 'schedule' && (
              <button
                onClick={() => setShowDateFilterModal(true)}
                className="px-4 py-3 shadow-md text-xs bg-white text-black rounded-md"
              >
                Add Filter
              </button>
            )}
            
            {/* All Status Filter */}
            <div className="relative w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
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
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
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
          </div>
          
          {/* Bottom row: Refresh button */}
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-2 text-sm bg-blue-500 text-white rounded-md shadow-md hover:bg-blue-600 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>
      )}
    </div>



      {/* Tab Content */}
      <div className="">
        {/* All Ads Tab */}
        {activeTab === 'ads' && (
          <div className="">
            {/* Stats Summary */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg">
                <p className="text-3xl text-center font-bold text-gray-900">{data?.getAllAds?.length || 0}</p>
                <h3 className="text-s text-center font-medium text-gray-500">Total Advertisement</h3>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-3xl text-center font-bold text-blue-500">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'RUNNING').length || 0}
                </p>
                <h3 className="text-sm text-center font-medium text-gray-500">Running</h3>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-3xl text-center font-bold text-green-600">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'APPROVED').length || 0}
                </p>
                <h3 className="text-sm text-center font-medium text-gray-500">Approved</h3>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-3xl text-center font-bold text-yellow-500">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'PENDING').length || 0}
                </p>
                <h3 className="text-sm text-center font-medium text-gray-500">Pending</h3>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-3xl text-center font-bold text-red-600">
                  {data?.getAllAds?.filter((ad: Ad) => ad.status === 'REJECTED').length || 0}
                </p>
                <h3 className="text-sm text-center font-medium text-gray-500">Rejected</h3>
              </div>
            </div>

            {/* Table */}
            {filteredAds.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                {searchTerm !== 'all' ? 'No ads match your search criteria' : 'No ads found'}
              </div>
            ) : (
              <div className="rounded-md mb-4 overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-3 text-sm font-semibold text-gray-600">
                  <div className="col-span-3">Title</div>
                  <div className="col-span-3">Advertiser</div>
                  <div className="col-span-2">Ad Type</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-center">Actions</div>
                </div>

                {filteredAds.map((ad: Ad) => (
                  <div key={ad.id} className="bg-white mb-3 rounded-lg shadow-md">
                    <div
                      className="grid grid-cols-12 items-center px-5 py-4 text-sm hover:bg-gray-100 transition-colors cursor-pointe"
                      onClick={() => handleRowClick(ad)}
                    >
                      <div className="col-span-3 truncate" title={ad.title}>{ad.title}</div>
                      <div className="col-span-3 truncate" title={getAdvertiserName(ad.userId)}>
                        {getAdvertiserName(ad.userId)}
                      </div>
                      <div className="col-span-2">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {ad.adType}
                        </span>
                      </div>
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
                              : 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {ad.status}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        {ad.status === 'PENDING' && (
                          <>
                            <button
                              className={`group flex items-center rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-20 transition-[width] duration-300 ${
                                processingAds.has(ad.id) 
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                  : 'bg-green-200 hover:bg-green-200 text-green-700'
                              }`}
                              onClick={(e) => { e.stopPropagation(); handleApprove(ad.id); }}
                              disabled={processingAds.has(ad.id)}
                              title={processingAds.has(ad.id) ? "Processing..." : "Approve"}
                            >
                              {processingAds.has(ad.id) ? (
                                <div className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                              ) : (
                                <Check className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              )}
                              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 whitespace-nowrap text-xs transition-all duration-300">
                                {processingAds.has(ad.id) ? 'Processing...' : 'Approve'}
                              </span>
                            </button>
                            <button
                              className={`group flex items-center rounded-md overflow-hidden shadow-md h-6 w-7 hover:w-16 transition-[width] duration-300 ${
                                processingAds.has(ad.id) 
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                  : 'bg-red-200 hover:bg-red-200 text-red-700'
                              }`}
                              onClick={(e) => { e.stopPropagation(); handleReject(ad.id); }}
                              disabled={processingAds.has(ad.id)}
                              title={processingAds.has(ad.id) ? "Processing..." : "Reject"}
                            >
                              {processingAds.has(ad.id) ? (
                                <div className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                              ) : (
                                <X className="w-4 h-4 flex-shrink-0 mx-auto ml-1.5 group-hover:ml-1 transition-all duration-300" />
                              )}
                              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-3 text-xs whitespace-nowrap transition-all duration-300">
                                {processingAds.has(ad.id) ? 'Processing...' : 'Reject'}
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
                    </div>
                  </div>
                ))}
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
          />
        )}

        {/* Plan Availability Tab */}
        {activeTab === 'availability' && <PlanAvailabilityTab />}
      </div>

      {/* Ad Details Modal */}
      {showAdDetailsModal && selectedAd && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleCloseAdModal} // closes the modal on outside click
        >
          <div
            className={`fixed top-2 bottom-2 right-2 max-w-2xl w-full bg-white shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out ${
              isAdModalOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()} // stops click from closing modal
          >
            <div className="h-full p-6 overflow-y-auto">

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold text-white bg-[#FF9D3D] mr-4 shadow-md">
                    {selectedAd.userId?.firstName ? selectedAd.userId.firstName[0] : 'U'}
                    {selectedAd.userId?.lastName ? selectedAd.userId.lastName[0] : 'N'}
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <h2 className="text-2xl font-bold text-gray-800">{getAdvertiserName(selectedAd.userId)}</h2>
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
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >  
                        {selectedAd.status}
                      </span>

                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-200 text-blue-800">{selectedAd.adType}</span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedAd.id}</p>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Media Preview */}
                <div className="flex flex-col space-y-4">
                  {selectedAd.mediaFile ? (
                    selectedAd.adFormat === 'IMAGE' ? (
                      <img
                        src={selectedAd.mediaFile}
                        alt="Ad media"
                        className="w-full h-64 object-contain bg-gray-100 rounded-lg shadow-md"
                        onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;base64,...'; }}
                      />
                    ) : selectedAd.adFormat === 'VIDEO' ? (
                      <video controls className="w-full h-64 bg-gray-100 rounded-lg shadow-md">
                        <source src={selectedAd.mediaFile} />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg">Media not available</div>
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg">Media not available</div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col space-y-4">
                  <h3 className="text-3xl mt-2 font-bold text-[#1B5087]">{selectedAd.title || 'N/A'}</h3>
                  <p className="text-gray-600 pb-16 text-sm">{selectedAd.description || 'No description provided'}</p>
                  <div className="flex items-center space-x-3">
                  <Tablet size={24} className="text-gray-500" />
                    <span className="truncate">{selectedAd.materialId?.id || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Coins size={24} className="text-gray-500" />
                    <span className="font-semibold text-lg text-[#FF9B45]">{formatCurrency(selectedAd.price)}</span>
                  </div>
                </div>
              </div>

              {/* Campaign Details */}
              <div className="mt-10">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Campaign Details</h4>
                <div className="mt-4 pt-4 grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-x-6">
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
            </div>
            {/* Rejection Notification */}
            {selectedAd.status === 'REJECTED' && showRejectionNotification && (
              <div className="fixed bottom-2 right-2 bg-red-600 text-white text-xs p-3 rounded-md shadow-lg max-w-sm z-50 flex justify-between items-start">
                <div>
                  <div className="font-bold mb-1">Advertisemnet has been rejected.</div>
                  <p className="text-lg">Reason: {selectedAd.reasonForReject || 'No reason provided.'}</p>
                </div>
                <button
                  onClick={() => setShowRejectionNotification(false)} // closes the notification
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
              <h2 className="text-xl font-bold text-gray-800">Reject Advertisement</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
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
                placeholder="Please provide a detailed reason for rejecting this advertisement..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">This reason will be visible to the advertiser.</p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setAdToReject(null);
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || (adToReject ? processingAds.has(adToReject) : false)}
                className={`px-4 py-2 text-white rounded transition-colors flex items-center gap-2 ${
                  !rejectReason.trim() || (adToReject ? processingAds.has(adToReject) : false)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {adToReject && processingAds.has(adToReject) && (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                )}
                {adToReject && processingAds.has(adToReject) ? 'Processing...' : 'Reject Advertisement'}
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
        message="Are you sure you want to delete this ad? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Date Filter Modal */}
      <DateFilter
        isOpen={showDateFilterModal}
        onClose={() => setShowDateFilterModal(false)}
        onApplyFilter={handleApplyDateFilter}
        onDeleteFilter={handleDeleteDateFilter}
      />
    </div>
  );
};

export default ManageAds;