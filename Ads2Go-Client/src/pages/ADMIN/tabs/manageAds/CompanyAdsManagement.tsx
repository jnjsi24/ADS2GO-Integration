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
  X
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

  // Filter ads based on search and status
  const filteredAds = companyAds.filter(ad => {
    const matchesSearch = ad.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ad.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ad.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && ad.isActive) ||
                         (statusFilter === 'inactive' && !ad.isActive);
    
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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Company Ads Management</h3>
          <p className="text-sm text-gray-600">Manage company advertisements and fallback content</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Company Ad
        </button>
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
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search company ads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
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
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ad title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter ad description"
                  />
                </div>

                {/* Media Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Media File *
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      {isUploading ? (
                        <div className="space-y-2">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="text-sm text-gray-600">
                            <p>Uploading... {uploadProgress}%</p>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
                          <p className="text-xs text-gray-500 truncate">{formData.mediaFile}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                            >
                              <span>Upload a file</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                accept="video/*,image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(file);
                                }}
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, MP4, MOV up to 100MB</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration and Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (seconds) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="300"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={formData.tags?.join(', ') || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter tags separated by commas"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter any additional notes"
                  />
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
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setSelectedAd(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {selectedAd ? 'Update Ad' : 'Create Ad'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAdsManagement;
