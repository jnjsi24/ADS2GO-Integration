import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Eye, 
  Upload, 
  Download,
  Search,
  Filter,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  Tag,
  FileVideo,
  Image as ImageIcon,
  X, ChevronDown,
  CloudUpload,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  GET_COMPANY_ADS,
  CREATE_COMPANY_AD, 
  UPDATE_COMPANY_AD, 
  DELETE_COMPANY_AD, 
  TOGGLE_COMPANY_AD_STATUS 
} from '../../../../graphql/admin';
import { uploadFileToFirebase } from '../../../../utils/fileUpload';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyAd {
  id: string;
  title: string;
  description?: string;
  mediaFile: string;
  adFormat: 'VIDEO' | 'IMAGE';
  duration: number;
  isActive: boolean;
  priority: number;
  tags?: string[];
  notes?: string;
  // Scheduling fields
  isScheduled: boolean;
  startDate?: string;
  endDate?: string;
  scheduleType: 'IMMEDIATE' | 'SCHEDULED';
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CreateCompanyAdInput {
  title: string;
  description?: string;
  mediaFile: string;
  adFormat: 'VIDEO' | 'IMAGE';
  isActive?: boolean;
  priority?: number;
  // Scheduling fields
  isScheduled?: boolean;
  startDate?: string;
  endDate?: string;
  scheduleType?: 'IMMEDIATE' | 'SCHEDULED';
}

const CompanyAdsManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'scheduled'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<CompanyAd | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaFileError, setMediaFileError] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    mediaFile?: string;
  }>({});

  // Form state for create/edit
  const [formData, setFormData] = useState<CreateCompanyAdInput>({
    title: '',
    description: '',
    mediaFile: '',
    adFormat: 'VIDEO',
    isActive: true, // Default to active for Deploy Now
    priority: 5, // Default to medium priority
    // Scheduling fields
    isScheduled: false,
    startDate: '',
    endDate: '',
    scheduleType: 'IMMEDIATE'
  });

  // GraphQL queries and mutations
  const { data, loading, error, refetch } = useQuery(GET_COMPANY_ADS);
  const [createCompanyAd] = useMutation(CREATE_COMPANY_AD);
  const [updateCompanyAd] = useMutation(UPDATE_COMPANY_AD);
  const [deleteCompanyAd] = useMutation(DELETE_COMPANY_AD);
  const [toggleStatus] = useMutation(TOGGLE_COMPANY_AD_STATUS);

  // Processing states for double-click prevention
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const companyAds: CompanyAd[] = data?.getAllCompanyAds || [];

  const statusFilterOptions = ['All Status', 'Active', 'Inactive', 'Scheduled'];

  const handleStatusFilterChange = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'all status') {
      setStatusFilter('all');
    } else if (normalizedStatus === 'active') {
      setStatusFilter('active');
    } else if (normalizedStatus === 'inactive') {
      setStatusFilter('inactive');
    } else if (normalizedStatus === 'scheduled') {
      setStatusFilter('scheduled');
    }
    setShowStatusDropdown(false);
  };

  // Filter ads based on search and status
  const filteredAds = companyAds.filter(ad => {
    const matchesSearch = ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ad.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && ad.isActive) ||
                         (statusFilter === 'inactive' && !ad.isActive) ||
                         (statusFilter === 'scheduled' && ad.isScheduled);
    
    console.log(`Filtering ads: statusFilter=${statusFilter}, ad.isActive=${ad.isActive}, ad.isScheduled=${ad.isScheduled}, matchesStatus=${matchesStatus}, matchesSearch=${matchesSearch}`);
    return matchesSearch && matchesStatus;
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

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const downloadURL = await uploadFileToFirebase(file, 'company-ads');
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Auto-detect format and duration
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension || '');
      
      setFormData(prev => ({
        ...prev,
        mediaFile: downloadURL,
        adFormat: isVideo ? 'VIDEO' : 'IMAGE',
        duration: isVideo ? 15 : 5 // Default durations
      }));
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setMediaFileError(''); // Clear any previous errors
      handleFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFileError(''); // Clear any previous errors
      handleFileUpload(file);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { title?: string; mediaFile?: string } = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.mediaFile) {
      errors.mediaFile = 'Media file is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Prevent multiple clicks
    if (isSubmitting) {
      return;
    }

    // Clear errors if validation passes
    setValidationErrors({});
    
    setIsSubmitting(true);
    
    try {
      if (selectedAd) {
        // Update existing ad
        await updateCompanyAd({
          variables: {
            id: selectedAd.id,
            input: formData
          }
        });
        setShowEditModal(false);
      } else {
        // Create new ad
        await createCompanyAd({
          variables: { input: formData }
        });
        setShowCreateModal(false);
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        mediaFile: '',
        adFormat: 'VIDEO',
        isActive: true, // Default to active for Deploy Now
        priority: 5, // Default to medium priority
        // Scheduling fields
        isScheduled: false,
        startDate: '',
        endDate: '',
        scheduleType: 'IMMEDIATE'
      });
      
      refetch();
    } catch (error) {
      console.error('Error saving company ad:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    // Prevent multiple clicks
    if (isDeleting) {
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this company ad?')) {
      setIsDeleting(true);
      
      try {
        await deleteCompanyAd({ variables: { id } });
        refetch();
      } catch (error) {
        console.error('Error deleting company ad:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Handle status toggle
  const handleToggleStatus = async (id: string) => {
    // Prevent multiple clicks on the same ad
    if (togglingId === id) {
      return;
    }
    
    setTogglingId(id);
    
    try {
      await toggleStatus({ variables: { id } });
      refetch();
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setTogglingId(null);
    }
  };

  // Handle edit
  const handleEdit = (ad: CompanyAd) => {
    setSelectedAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || '',
      mediaFile: ad.mediaFile,
      adFormat: ad.adFormat,
      isActive: ad.isActive,
      priority: ad.priority,
      // Scheduling fields
      isScheduled: ad.isScheduled || false,
      startDate: ad.startDate || '',
      endDate: ad.endDate || '',
      scheduleType: ad.scheduleType || 'IMMEDIATE'
    });
    setShowEditModal(true);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg text-gray-600">Loading company ads...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-red-800">Error loading company ads: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        {/* Row 1 */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Company Ads Management
          </h3>

          <div className="flex gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search company ads..."
              className="text-xs text-black rounded-lg pl-5 py-3 w-80 shadow-md focus:outline-none bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Filter Dropdown */}
            <div className="relative w-32">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
              >
                {statusFilter === "all"
                  ? "All Status"
                  : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    showStatusDropdown ? "rotate-180" : "rotate-0"
                  }`}
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

        {/* Row 2 - Button aligned under search/filter */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Company Ad
          </button>
        </div>
      </div>


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center">
            <FileVideo className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Ads</p>
              <p className="text-2xl font-semibold text-gray-900">{companyAds.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-semibold text-gray-900">
                {companyAds.filter(ad => ad.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        
      </div>


      {/* Company Ads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedAds.map((ad) => (
          <div key={ad.id} className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            {/* Media Preview */}
            <div className="aspect-video bg-gray-100 rounded-t-lg relative overflow-hidden">
              {ad.mediaFile ? (
                ad.adFormat === 'VIDEO' ? (
                  <video
                    src={ad.mediaFile}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <img
                    src={ad.mediaFile}
                    alt={ad.title}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  {ad.adFormat === 'VIDEO' ? (
                    <FileVideo className="h-12 w-12 text-gray-400" />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                  )}
                </div>
              )}
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                  ad.isActive 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-gray-100 text-gray-800 border border-gray-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${ad.isActive ? 'bg-green-600' : 'bg-gray-600'}`}></div>
                  <span>{ad.isActive ? 'Active' : 'Inactive'}</span>
                </span>
              </div>

              {/* Format Badge */}
              <div className="absolute top-2 left-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {ad.adFormat}
                </span>
              </div>

              {/* Priority Badge */}
              <div className="absolute bottom-2 right-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  ad.priority >= 8 
                    ? 'bg-red-100 text-red-800' 
                    : ad.priority >= 5 
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {ad.priority >= 8 ? 'High' : ad.priority >= 5 ? 'Medium' : 'Low'}
                </span>
              </div>

              {/* Scheduling Badge */}
              {ad.isScheduled && (
                <div className="absolute bottom-2 left-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                    ad.scheduleType === 'SCHEDULED' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span>{ad.scheduleType === 'SCHEDULED' ? 'Scheduled' : 'Scheduled'}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900 truncate">{ad.title}</h4>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleToggleStatus(ad.id)}
                    disabled={togglingId === ad.id}
                    className={`p-1 rounded transition-colors ${
                      togglingId === ad.id
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-gray-100'
                    }`}
                    title={togglingId === ad.id ? 'Processing...' : (ad.isActive ? 'Deactivate' : 'Activate')}
                  >
                    {togglingId === ad.id ? (
                      <div className="w-4 h-4 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
                    ) : ad.isActive ? (
                      <Pause className="h-4 w-4 text-orange-600" />
                    ) : (
                      <Play className="h-4 w-4 text-green-600" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(ad)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4 text-blue-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    disabled={isDeleting}
                    className={`p-1 rounded transition-colors ${
                      isDeleting
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-gray-100'
                    }`}
                    title={isDeleting ? 'Processing...' : 'Delete'}
                  >
                    {isDeleting ? (
                      <div className="w-4 h-4 animate-spin border-2 border-red-600 border-t-transparent rounded-full" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-600" />
                    )}
                  </button>
                </div>
              </div>

              {ad.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ad.description}</p>
              )}


              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-medium">Status</p>
                  <div className={`font-semibold flex items-center space-x-1 ${
                    ad.isActive ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${ad.isActive ? 'bg-green-600' : 'bg-gray-600'}`}></div>
                    <span>{ad.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div>
                  <p className="font-medium">Priority</p>
                  <p className={`font-semibold ${
                    ad.priority >= 8 ? 'text-red-600' : 
                    ad.priority >= 5 ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {ad.priority >= 8 ? 'High' : ad.priority >= 5 ? 'Medium' : 'Low'}
                  </p>
                </div>
              </div>

              {/* Creation Date */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">Created:</span>
                  <span>{formatDate(ad.createdAt)}</span>
                </div>
              </div>

              {/* Scheduling Info */}
              {ad.isScheduled && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                      {ad.scheduleType === 'SCHEDULED' ? 'Scheduled' : 'Scheduled'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {ad.startDate && (
                      <p>• <strong>Starts:</strong> {new Date(ad.startDate).toLocaleDateString()}</p>
                    )}
                    {ad.endDate && (
                      <p>• <strong>Ends:</strong> {new Date(ad.endDate).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {filteredAds.length > 0 && (
        <div className="flex items-center justify-center px-4 py-4 mt-6 border-t">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span>Previous</span>
            </button>

            <div className="flex gap-1">
              {(() => {
                const pages = [];
                const maxVisiblePages = 5;
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
                      className={`px-3 py-1 text-sm rounded ${
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
              className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredAds.length === 0 && (
        <div className="text-center py-12">
          <FileVideo className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No company ads found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first company ad.'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Company Ad
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50"></div>
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedAd ? 'Edit Company Ad' : 'Create Company Ad'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedAd(null);
                  setFormData({
                    title: '',
                    description: '',
                    mediaFile: '',
                    adFormat: 'VIDEO',
                    isActive: true,
                    priority: 0
                  });
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="relative">
                <input
                  type="text"
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.title ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder=""
                />
                <label
                  htmlFor="title"
                  className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${formData.title ? '-top-2 text-sm text-black/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
                >
                  Enter Ad title
                </label>
                {validationErrors.title && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div className="relative">
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition border-gray-300"
                  placeholder=""
                />
                <label
                  htmlFor="description"
                  className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${formData.description ? '-top-2 text-sm text-black/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
                >
                  Enter Ad description
                </label>
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Media File
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 transition-colors flex flex-col items-center justify-center text-center
                    ${isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : mediaFileError
                      ? 'border-red-500 bg-red-50'
                      : 'border-black/60 bg-transparent'}
                  `}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <CloudUpload
                    className={`w-12 h-12 mb-4 ${
                      mediaFileError ? 'text-red-400' : 'text-black/60'
                    }`}
                  />
                  
                  {isUploading ? (
                    <div className="w-full space-y-2">
                      <p className="text-black/80">Uploading... {uploadProgress}%</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-md mx-auto">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-black/80 mb-4">Drag your file image/video here</p>

                      {/* Divider with 'or' */}
                      <div className="flex items-center justify-center mb-4 w-full">
                        <div
                          className={`grow max-w-40 h-px ${
                            mediaFileError ? 'bg-red-300' : 'bg-gray-300'
                          }`}
                        ></div>
                        <span
                          className={`mx-3 text-sm ${
                            mediaFileError ? 'text-red-400' : 'text-black/80'
                          }`}
                        >
                          or
                        </span>
                        <div
                          className={`grow max-w-40 h-px ${
                            mediaFileError ? 'bg-red-300' : 'bg-gray-300'
                          }`}
                        ></div>
                      </div>

                      {/* Centered Upload Button */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setMediaFileError('');
                            document.getElementById('media-upload')?.click();
                          }}
                          onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                            const button = e.currentTarget;
                            const rect = button.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;
                            button.style.setProperty('--x', `${x}px`);
                            button.style.setProperty('--y', `${y}px`);
                          }}
                          className={`relative p-3 rounded-md font-medium text-xs text-white w-40 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:scale-105 shadow-md
                            ${
                              mediaFileError
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-gradient-to-r from-[#1B5087] to-[#3674B5]'
                            }`}
                        >
                          {/* Shiny Hover Effect */}
                          <span
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{
                              background:
                                'radial-gradient(circle at var(--x, 20%) var(--y, 80%), rgba(255, 255, 255, 0.15) 0%, transparent 50%)',
                            }}
                          />
                          <span className="relative z-10">Click to upload file</span>
                        </button>
                      </div>

                      {/* Uploaded File Display - Inside Upload Box */}
                      {formData.mediaFile && (
                        <div className="flex items-center justify-between mt-4 p-2 rounded-md max-w-md mx-auto">
                          <p className="text-sm text-green-600 truncate flex-1">
                            Selected: {formData.mediaFile.split('/').pop() || formData.mediaFile}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, mediaFile: '' }));
                              const fileInput = document.getElementById('media-upload') as HTMLInputElement;
                              if (fileInput) fileInput.value = '';
                            }}
                            className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors"
                            title="Remove file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.ogg,.webm,.mov,image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/ogg,video/webm,video/quicktime"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="media-upload"
                  />
                </div>
                {/* Show validation errors from form validation OR media file error */}
                {(validationErrors.mediaFile || mediaFileError) && (
                  <p className="text-sm text-red-600 mt-1">
                    {mediaFileError || validationErrors.mediaFile}
                  </p>
                )}
              </div>

              {/* Priority Slider */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">
                  Priority Level
                </label>
                <div className="space-y-4">
                  {/* Priority Options */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 2, label: 'Low', color: 'bg-gray-100 text-gray-800', selectedColor: 'bg-gray-500 text-white' },
                      { value: 5, label: 'Medium', color: 'bg-yellow-100 text-yellow-800', selectedColor: 'bg-yellow-500 text-white' },
                      { value: 8, label: 'High', color: 'bg-red-100 text-red-800', selectedColor: 'bg-red-500 text-white' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, priority: option.value }))}
                        className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                          formData.priority === option.value
                            ? option.selectedColor
                            : option.color
                        } ${
                          formData.priority === option.value
                            ? 'ring-2 ring-offset-2 ring-blue-500 shadow-md'
                            : 'hover:shadow-sm'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* Visual Priority Indicator */}
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-sm text-gray-600">Priority:</span>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                        <div
                          key={level}
                          className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                            level <= (formData.priority || 5)
                              ? (formData.priority || 5) <= 3
                                ? 'bg-gray-400'
                                : (formData.priority || 5) <= 7
                                ? 'bg-yellow-400'
                                : 'bg-red-400'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{formData.priority || 5}/10</span>
                  </div>

                  {/* Priority Guide */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-2">How Priority Works:</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span><strong>High (8-10):</strong> Plays very frequently as filler content</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span><strong>Medium (4-7):</strong> Plays moderately as filler content</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                            <span><strong>Low (1-3):</strong> Plays rarely as filler content</span>
                          </div>
                          <div className="mt-2 p-2 bg-blue-100 rounded text-xs">
                            <p><strong>💡 Tip:</strong> Higher priority = more chances to be selected when there are fewer than 5 user ads playing</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>




              {/* Scheduling Section */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-4">
                  Scheduling
                </label>
                <div className="space-y-4">
                  {/* Schedule Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deployment Option
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'IMMEDIATE', label: 'Deploy Now', description: 'Start playing immediately', icon: '🚀' },
                        { value: 'SCHEDULED', label: 'Scheduled', description: 'Play during specific dates', icon: '📅' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            scheduleType: option.value as any,
                            isScheduled: option.value !== 'IMMEDIATE',
                            isActive: option.value === 'IMMEDIATE' // Deploy Now = Active, Scheduled = Inactive initially
                          }))}
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                            formData.scheduleType === option.value
                              ? 'bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500 shadow-md'
                              : 'bg-gray-100 text-gray-800 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{option.icon}</span>
                            <div className="text-left">
                              <div className="text-sm font-medium">{option.label}</div>
                              <div className="text-xs opacity-80">{option.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range Selection (for SCHEDULED only) */}
                  {formData.scheduleType === 'SCHEDULED' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.startDate || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          End Date
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.endDate || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}


                  {/* Status Preview */}
                  <div className={`border rounded-lg p-3 ${
                    formData.scheduleType === 'IMMEDIATE' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0">
                        <svg className={`h-5 w-5 mt-0.5 ${
                          formData.scheduleType === 'IMMEDIATE' ? 'text-green-600' : 'text-yellow-600'
                        }`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className={`text-sm ${
                        formData.scheduleType === 'IMMEDIATE' ? 'text-green-800' : 'text-yellow-800'
                      }`}>
                        <p className="font-medium">
                          {formData.scheduleType === 'IMMEDIATE' ? 'Deploy Now Status:' : 'Scheduled Status:'}
                        </p>
                        <div className="mt-1 space-y-1 text-xs">
                          {formData.scheduleType === 'IMMEDIATE' ? (
                            <>
                              <p>• <strong>Status:</strong> <span className="text-green-600 font-semibold">Active</span> (starts playing immediately)</p>
                              <p>• <strong>Control:</strong> Only stops when you manually set to inactive</p>
                            </>
                          ) : (
                            <>
                              <p>• <strong>Status:</strong> <span className="text-yellow-600 font-semibold">Inactive</span> (waits for start date)</p>
                              <p>• <strong>Auto-activation:</strong> Will become active when start date is reached</p>
                              <p>• <strong>Auto-deactivation:</strong> Will become inactive when end date is reached</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule Preview for Scheduled ads */}
                  {formData.scheduleType === 'SCHEDULED' && (formData.startDate || formData.endDate) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="text-sm text-blue-800">
                          <p className="font-medium">Schedule Details:</p>
                          <div className="mt-1 space-y-1 text-xs">
                            {formData.startDate && (
                              <p>• <strong>Starts:</strong> {new Date(formData.startDate).toLocaleString()}</p>
                            )}
                            {formData.endDate && (
                              <p>• <strong>Ends:</strong> {new Date(formData.endDate).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-between gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedAd(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[#3674B5] hover:bg-[#578FCA]'
                  }`}
                >
                  {isSubmitting && (
                    <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  )}
                  {isSubmitting ? 'Processing...' : (selectedAd ? 'Update Ad' : 'Create Ad')}
                </button>
              </div>
            </form>
          </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CompanyAdsManagement;
