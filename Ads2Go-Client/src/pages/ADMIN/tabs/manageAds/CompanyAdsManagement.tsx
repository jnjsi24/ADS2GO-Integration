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
  Clock,
  BarChart3,
  Tag,
  FileVideo,
  Image as ImageIcon,
  X, ChevronDown,
  CloudUpload
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
  playCount: number;
  lastPlayed?: string;
  tags: string[];
  notes?: string;
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
  duration: number;
  isActive?: boolean;
  priority?: number;
  tags?: string[];
  notes?: string;
}

const CompanyAdsManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<CompanyAd | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaFileError, setMediaFileError] = useState('');
  
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    duration?: string;
    mediaFile?: string;
  }>({});

  // Form state for create/edit
  const [formData, setFormData] = useState<CreateCompanyAdInput>({
    title: '',
    description: '',
    mediaFile: '',
    adFormat: 'VIDEO',
    duration: 15,
    isActive: true,
    priority: 0,
    tags: [],
    notes: ''
  });

  // GraphQL queries and mutations
  const { data, loading, error, refetch } = useQuery(GET_COMPANY_ADS);
  const [createCompanyAd] = useMutation(CREATE_COMPANY_AD);
  const [updateCompanyAd] = useMutation(UPDATE_COMPANY_AD);
  const [deleteCompanyAd] = useMutation(DELETE_COMPANY_AD);
  const [toggleStatus] = useMutation(TOGGLE_COMPANY_AD_STATUS);

  const companyAds: CompanyAd[] = data?.getAllCompanyAds || [];

  const statusFilterOptions = ['All Status', 'Active', 'Inactive'];

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status.toLowerCase() as 'all' | 'active' | 'inactive');
    setShowStatusDropdown(false);
  };

  // Filter ads based on search and status
  const filteredAds = companyAds.filter(ad => {
    const matchesSearch = ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ad.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ad.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && ad.isActive) ||
                         (statusFilter === 'inactive' && !ad.isActive);
    
    console.log(`Filtering ads: statusFilter=${statusFilter}, ad.isActive=${ad.isActive}, matchesStatus=${matchesStatus}, matchesSearch=${matchesSearch}`);
    return matchesSearch && matchesStatus;
  });

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

    const errors: { title?: string; duration?: string; mediaFile?: string } = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formData.mediaFile) {
      errors.mediaFile = 'Media file is required';
    }
    if (!formData.duration || formData.duration < 1 || formData.duration > 300) {
      errors.duration = 'Duration must be between 1 and 300 seconds';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setValidationErrors({});
    
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
        duration: 15,
        isActive: true,
        priority: 0,
        tags: [],
        notes: ''
      });
      
      refetch();
    } catch (error) {
      console.error('Error saving company ad:', error);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this company ad?')) {
      try {
        await deleteCompanyAd({ variables: { id } });
        refetch();
      } catch (error) {
        console.error('Error deleting company ad:', error);
      }
    }
  };

  // Handle status toggle
  const handleToggleStatus = async (id: string) => {
    try {
      await toggleStatus({ variables: { id } });
      refetch();
    } catch (error) {
      console.error('Error toggling status:', error);
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
      duration: ad.duration,
      isActive: ad.isActive,
      priority: ad.priority,
      tags: ad.tags,
      notes: ad.notes || ''
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Plays</p>
              <p className="text-2xl font-semibold text-gray-900">
                {companyAds.reduce((sum, ad) => sum + ad.playCount, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avg Duration</p>
              <p className="text-2xl font-semibold text-gray-900">
                {companyAds.length > 0 
                  ? formatDuration(Math.round(companyAds.reduce((sum, ad) => sum + ad.duration, 0) / companyAds.length))
                  : '0:00'
                }
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
        {filteredAds.map((ad) => (
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
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  ad.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {ad.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Format Badge */}
              <div className="absolute top-2 left-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {ad.adFormat}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-900 truncate">{ad.title}</h4>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleToggleStatus(ad.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={ad.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {ad.isActive ? (
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
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>

              {ad.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{ad.description}</p>
              )}

              {/* Tags */}
              {ad.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {ad.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <p className="font-medium">Duration</p>
                  <p>{formatDuration(ad.duration)}</p>
                </div>
                <div>
                  <p className="font-medium">Plays</p>
                  <p>{ad.playCount}</p>
                </div>
                <div>
                  <p className="font-medium">Priority</p>
                  <p>{ad.priority}</p>
                </div>
                <div>
                  <p className="font-medium">Created</p>
                  <p>{formatDate(ad.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

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
                    duration: 15,
                    isActive: true,
                    priority: 0,
                    tags: [],
                    notes: ''
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
                  Media File *
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging ? 'border-blue-500 bg-blue-50' : 
                    mediaFileError ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                    {isUploading ? (
                      <div className="space-y-2">
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="text-sm text-gray-600">
                          <p>Uploading... {uploadProgress}%</p>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ) : formData.mediaFile ? (
                      <div className="space-y-2">
                        {formData.adFormat === 'VIDEO' ? (
                          <FileVideo className="mx-auto h-12 w-12 text-blue-600" />
                        ) : (
                          <ImageIcon className="mx-auto h-12 w-12 text-blue-600" />
                        )}
                        <p className="text-sm text-gray-600">File uploaded successfully</p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{formData.mediaFile}</p>
                      </div>
                    ) : (
                    <>
                      <CloudUpload className={`w-12 h-12 mx-auto mb-4 ${
                        mediaFileError ? 'text-red-400' : 'text-gray-400'
                      }`} />
                      <p className="text-gray-600 mb-4">
                        Drag your file image/video here
                      </p>
                      <div className="flex items-center justify-center mb-4">
                        <div className={`grow max-w-40 h-px ${
                          mediaFileError ? 'bg-red-300' : 'bg-gray-300'
                        }`}></div>
                        <span className={`mx-3 text-sm ${
                          mediaFileError ? 'text-red-400' : 'text-gray-400'
                        }`}>or</span>
                        <div className={`grow max-w-40 h-px ${
                          mediaFileError ? 'bg-red-300' : 'bg-gray-300'
                        }`}></div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMediaFileError(''); // Clear error when clicking upload
                          document.getElementById('media-upload')?.click();
                        }}
                        className={`p-3 rounded-md hover:text-white/90 font-medium ${
                          mediaFileError 
                            ? 'text-white/80 bg-red-500 hover:bg-red-600' 
                            : 'text-white/80 bg-[#3674B5] hover:bg-[#1B5087]'
                        }`}
                      >
                        Click to upload file
                      </button>
                      <p className={`text-sm mt-2 ${
                        mediaFileError ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        PNG, JPG, MP4, MOV up to 100MB
                      </p>
                            <input
                              type="file"
                        accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.ogg,.webm,.mov,image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/ogg,video/webm,video/quicktime"
                        onChange={handleFileInputChange}
                        className="hidden"
                        id="media-upload"
                        required
                      />
                    </>
                  )}
                        </div>
                {/* Show validation errors from form validation OR media file error */}
                {(validationErrors.mediaFile || mediaFileError) && (
                  <p className="text-sm text-red-600 mt-1">
                    {mediaFileError || validationErrors.mediaFile}
                  </p>
                )}
              </div>

              {/* Duration and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="number"
                    id="duration"
                    required
                    min="1"
                    max="300"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.duration ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder=""
                  />
                  <label
                    htmlFor="duration"
                    className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${formData.duration ? '-top-2 text-sm text-black/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
                  >
                    Duration (seconds)
                  </label>
                  {validationErrors.duration && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.duration}</p>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    id="priority"
                    min="0"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition border-gray-300"
                    placeholder=""
                  />
                  <label
                    htmlFor="priority"
                    className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${formData.priority ? '-top-2 text-sm text-black/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
                  >
                    Priority
                  </label>
                </div>
              </div>

              {/* Tags */}
              <div className="relative">
                <input
                  type="text"
                  id="tags"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                  }))}
                  className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition border-gray-300"
                  placeholder=""
                />
                <label
                  htmlFor="tags"
                  className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${formData.tags?.length ? '-top-2 text-sm text-black/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
                >
                  Enter tags separated by commas
                </label>
              </div>

              {/* Notes */}
              <div className="relative">
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition border-gray-300"
                  placeholder=""
                />
                <label
                  htmlFor="notes"
                  className={`absolute left-0 text-black bg-transparent transition-all duration-200 ${formData.notes ? '-top-2 text-sm text-black/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-black'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black/70 peer-focus:font-bold`}
                >
                  Enter any additional notes
                </label>
              </div>

              {/* Active Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active (will be shown in rotation)
                </label>
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
                  className="px-4 py-2 text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors"
                >
                  {selectedAd ? 'Update Ad' : 'Create Ad'}
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
