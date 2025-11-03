import React, { useState, useEffect } from 'react';
import { useMutation, useLazyQuery, useQuery } from '@apollo/client';
import { X, Upload, Loader2, AlertCircle, Calendar as CalendarIcon, ChevronDown, TrendingUp } from 'lucide-react';
import { UPDATE_AD } from '../graphql/user';
import { GET_MY_ADS } from '../graphql/user/queries/getMyAds';
import { CALCULATE_FLEXIBLE_PRICING, FlexiblePricingCalculation, GET_FLEXIBLE_FIELD_COMBINATIONS } from '../graphql/queries/flexibleAdQueries';
import { uploadFileToFirebase } from '../utils/fileUpload';
import { useToast, ToastContainer } from './ToastNotification';
import CalendarWidget from './CalendarWidget';

interface EditAdModalProps {
  ad: any;
  onClose: () => void;
  onSuccess: () => void;
}

const EditAdModal: React.FC<EditAdModalProps> = ({ ad, onClose, onSuccess }) => {
  const { toasts, addToast, removeToast } = useToast();

  // Parse start date - handle both timestamp strings and ISO strings
  const parseStartDate = (): Date => {
    if (!ad.startTime) return new Date(); // Default to today
    
    try {
      // Try parsing as timestamp (milliseconds since epoch)
      const timestamp = parseInt(ad.startTime);
      if (!isNaN(timestamp) && timestamp > 0) {
        const date = new Date(timestamp);
        // Validate the date is reasonable (not epoch, not too far in past/future)
        if (date.getFullYear() > 2000 && date.getFullYear() < 2100) {
          return date;
        }
      }
      
      // Try parsing as ISO string
      const isoDate = new Date(ad.startTime);
      if (!isNaN(isoDate.getTime()) && isoDate.getFullYear() > 2000) {
        return isoDate;
      }
    } catch (error) {
      console.error('Error parsing start date:', error);
    }
    
    // Fallback to today's date
    return new Date();
  };

  const initialStartDate = parseStartDate();

  const [formData, setFormData] = useState({
    title: ad.title || '',
    description: ad.description || '',
    adFormat: ad.adFormat || 'VIDEO',
    mediaFile: ad.mediaFile || '',
    startTime: initialStartDate.toISOString().split('T')[0],
    adLengthSeconds: ad.adLengthSeconds || 20,
    durationDays: ad.durationDays || 30,
    numberOfDevices: ad.numberOfDevices || 1,
    materialType: ad.materialType || '',
    vehicleType: ad.vehicleType || '',
    category: ad.category || 'DIGITAL',
  });

  const [newMediaFile, setNewMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(ad.mediaFile || '');
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialStartDate);
  const [showAdLengthDropdown, setShowAdLengthDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showVehicleTypeDropdown, setShowVehicleTypeDropdown] = useState(false);
  const [showMaterialTypeDropdown, setShowMaterialTypeDropdown] = useState(false);
  const [pricingCalculation, setPricingCalculation] = useState<FlexiblePricingCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch field combinations
  const { data: fieldCombinationsData } = useQuery(GET_FLEXIBLE_FIELD_COMBINATIONS);
  const fieldCombinations = fieldCombinationsData?.getFlexibleFieldCombinations || [];

  // Fetch pricing calculation
  const [calculatePricing] = useLazyQuery(CALCULATE_FLEXIBLE_PRICING);

  // Update ad mutation
  const [updateAd, { loading: updating }] = useMutation(UPDATE_AD, {
    refetchQueries: [{ query: GET_MY_ADS }],
    onCompleted: (data) => {
      console.log('✅ [EditAdModal] Mutation completed successfully:', data);
      addToast({
        title: 'Success!',
        message: 'Advertisement updated successfully! The ad will require admin re-approval if settings changed.',
        type: 'success'
      });
      onSuccess();
      onClose();
    },
    onError: (error) => {
      console.error('❌ [EditAdModal] Mutation error:', error);
      setErrors({ submit: error.message });
      addToast({
        title: 'Error!',
        message: `Failed to update ad: ${error.message}`,
        type: 'error'
      });
    },
  });

  // Auto-determine category based on material type
  useEffect(() => {
    if (formData.materialType === 'LCD' || formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    }
  }, [formData.materialType]);

  // Reset materialType when vehicleType changes to MOTORCYCLE or is cleared
  useEffect(() => {
    if (formData.vehicleType === 'MOTORCYCLE' && formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, materialType: '' }));
    } else if (!formData.vehicleType) {
      setFormData(prev => ({ ...prev, materialType: '' }));
    }
  }, [formData.vehicleType]);

  // Auto-calculate pricing when campaign settings change
  useEffect(() => {
    const allowedAdLengths = [20, 40, 60];
    if (formData.materialType && 
        formData.vehicleType && 
        formData.category && 
        allowedAdLengths.includes(formData.adLengthSeconds)) {
      calculatePricingAsync();
    }
  }, [formData.materialType, formData.vehicleType, formData.category, formData.durationDays, formData.adLengthSeconds, formData.numberOfDevices]);

  const calculatePricingAsync = async () => {
    setIsCalculating(true);
    try {
      const result = await calculatePricing({
        variables: {
          materialType: formData.materialType,
          vehicleType: formData.vehicleType,
          category: formData.category,
          durationDays: formData.durationDays,
          adLengthSeconds: formData.adLengthSeconds,
          numberOfDevices: formData.numberOfDevices
        }
      });
      if (result.data) {
        setPricingCalculation(result.data.calculateFlexiblePricing);
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
      setPricingCalculation(null);
    } finally {
      setIsCalculating(false);
    }
  };

  // Get available vehicle types
  const getAvailableVehicleTypes = (): string[] => {
    const types = new Set<string>();
    fieldCombinations.forEach((combo: any) => {
      if (combo.isActive) {
        types.add(combo.vehicleType);
      }
    });
    return Array.from(types).sort();
  };

  // Get available material types based on selected vehicle type
  const getAvailableMaterialTypes = (): string[] => {
    if (!formData.vehicleType) return [];
    const types = new Set<string>();
    fieldCombinations.forEach((combo: any) => {
      if (combo.isActive && combo.vehicleType === formData.vehicleType) {
        types.add(combo.materialType);
      }
    });
    return Array.from(types).sort();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCalendarDateSelect = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      const dateString = date.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, startTime: dateString }));
      if (errors.startTime) {
        setErrors(prev => ({ ...prev, startTime: '' }));
      }
    } else {
      setFormData(prev => ({ ...prev, startTime: '' }));
    }
    setShowCalendar(false);
  };

  const toggleCalendar = () => {
    if (errors.startTime) {
      setErrors(prev => ({ ...prev, startTime: '' }));
    }
    setShowCalendar(!showCalendar);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      setErrors({ mediaFile: 'Please select a valid video or image file' });
      return;
    }

    setNewMediaFile(file);
    setFormData(prev => ({ ...prev, adFormat: isVideo ? 'VIDEO' : 'IMAGE' }));

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    if (errors.mediaFile) {
      setErrors(prev => ({ ...prev, mediaFile: '' }));
    }
  };

  const uploadMediaFile = async (file: File): Promise<string> => {
    try {
      console.log('📤 Uploading media file to Firebase:', file.name);
      const downloadURL = await uploadFileToFirebase(file, 'advertisements');
      console.log('✅ Media file uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Error uploading media file:', error);
      throw new Error('Failed to upload media file. Please try again.');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.vehicleType) {
      newErrors.vehicleType = 'Vehicle type is required';
    }

    if (!formData.materialType) {
      newErrors.materialType = 'Material type is required';
    }

    const allowedAdLengths = [20, 40, 60];
    if (!allowedAdLengths.includes(formData.adLengthSeconds)) {
      newErrors.adLengthSeconds = 'Please select a valid ad length (20, 40, or 60 seconds)';
    }

    const allowedDurations = [30, 60, 90, 120, 150, 180];
    if (!allowedDurations.includes(formData.durationDays)) {
      newErrors.durationDays = 'Duration must be 1-6 months (30-180 days)';
    }

    if (formData.numberOfDevices < 1) {
      newErrors.numberOfDevices = 'At least 1 device is required';
    }

    if (pricingCalculation?.maxDevices && formData.numberOfDevices > pricingCalculation.maxDevices) {
      newErrors.numberOfDevices = `Maximum ${pricingCalculation.maxDevices} devices allowed`;
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start date is required';
    }
    // Note: Removed past date validation to allow editing existing ads with past start dates

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔄 [EditAdModal] Submit button clicked');
    console.log('📋 [EditAdModal] Form data:', formData);
    console.log('💰 [EditAdModal] Pricing calculation:', pricingCalculation);

    if (!validateForm()) {
      console.log('❌ [EditAdModal] Validation failed:', errors);
      return;
    }

    if (!pricingCalculation) {
      console.log('⚠️ [EditAdModal] Waiting for pricing calculation...');
      setErrors({ submit: 'Please wait for pricing calculation to complete.' });
      return;
    }

    try {
      setUploading(true);
      console.log('🚀 [EditAdModal] Starting update process...');
      
      let mediaFileUrl = formData.mediaFile;

      // Upload new media file if selected
      if (newMediaFile) {
        console.log('📤 [EditAdModal] Uploading new media file...');
        mediaFileUrl = await uploadMediaFile(newMediaFile);
        console.log('✅ [EditAdModal] Media file uploaded:', mediaFileUrl);
      }

      // Prepare update input
      const updateInput: any = {
        title: formData.title,
        description: formData.description,
        adFormat: formData.adFormat,
        adLengthSeconds: formData.adLengthSeconds,
        durationDays: formData.durationDays,
        numberOfDevices: formData.numberOfDevices,
        price: pricingCalculation.totalPrice,
        materialType: formData.materialType,
        vehicleType: formData.vehicleType,
        category: formData.category,
      };

      // Only include mediaFile if changed
      if (newMediaFile) {
        updateInput.mediaFile = mediaFileUrl;
      }

      // Only include startTime if changed
      const originalStartDate = ad.startTime ? new Date(parseInt(ad.startTime)).toISOString().split('T')[0] : '';
      if (formData.startTime !== originalStartDate) {
        updateInput.startTime = new Date(formData.startTime).toISOString();
        console.log('📅 [EditAdModal] Start time changed from', originalStartDate, 'to', formData.startTime);
      }

      console.log('📦 [EditAdModal] Update input:', updateInput);

      await updateAd({
        variables: {
          id: ad.id,
          input: updateInput,
        },
      });

      console.log('✅ [EditAdModal] Ad updated successfully!');
    } catch (error: any) {
      console.error('❌ [EditAdModal] Error updating ad:', error);
      setErrors({ submit: error.message || 'Failed to update ad' });
    } finally {
      setUploading(false);
    }
  };

  // Calculate end date based on start date and duration
  const calculateEndDate = () => {
    if (!formData.startTime) return '';
    const startDate = new Date(formData.startTime);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + formData.durationDays);
    return endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getDurationLabel = (days: number): string => {
    const months = days / 30;
    return `${months} month${months > 1 ? 's' : ''} (${days} days)`;
  };

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
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

  return (
    <>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-md max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Advertisement</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div className="relative">
            <input
              type="text"
              id="edit-title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder=""
              required
              className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${errors.title ? 'border-red-400' : 'border-gray-300'}`}
              style={{ backgroundColor: 'transparent' }}
            />
            <label
              htmlFor="edit-title"
              className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.title
                ? '-top-2 text-sm text-gray-700 font-bold'  
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
            >
              Title
            </label>
            {errors.title && (
              <p className="text-red-400 text-xs mt-1">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="relative mt-6">
            <textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              placeholder=""
              required
              className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition resize-none ${errors.description ? 'border-red-400' : 'border-gray-300'}`}
              style={{ backgroundColor: 'transparent' }}
            />
            <label
              htmlFor="edit-description"
              className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.description
                ? '-top-2 text-sm text-gray-700 font-bold'  
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
            >
              Description
            </label>
            {errors.description && (
              <p className="text-red-400 text-xs mt-1">{errors.description}</p>
            )}
          </div>

          {/* Media File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Media File (Optional - leave unchanged to keep current media)
            </label>
            <div className="space-y-3">
              {/* Current/Preview */}
              {previewUrl && (
                <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
                  {formData.adFormat === 'VIDEO' ? (
                    <video src={previewUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                  )}
                </div>
              )}

              {/* Upload Button */}
              <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-5 h-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">
                  {newMediaFile ? newMediaFile.name : 'Click to upload new media'}
                </span>
                <input
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {errors.mediaFile && (
              <p className="mt-1 text-sm text-red-600">{errors.mediaFile}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Start Date
              </label>
              <div className="relative calendar-container">
                <button
                  type="button"
                  onClick={toggleCalendar}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"
                  >
                  <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedDate 
                      ? selectedDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Select start date'}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                </button>

                {showCalendar && (
                  <div className="absolute z-50 mt-2 bg-white rounded-md shadow-lg border border-gray-200">
                    <CalendarWidget
                      selectedDate={selectedDate}
                      onDateSelect={handleCalendarDateSelect}
                      minDate={new Date()}
                    />
                  </div>
                )}
              </div>
              {errors.startTime && (
                <p className="mt-1 text-sm text-red-600">{errors.startTime}</p>
              )}
              {formData.startTime && (
                <p className="mt-2 text-sm text-red-500">
                  Campaign will end on: <span className="font-medium">{calculateEndDate()}</span>
                </p>
              )}
            </div>

            {/* Campaign Duration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Duration
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDurationDropdown(!showDurationDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"

                >
                  <span className="truncate">{getDurationLabel(formData.durationDays)}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${showDurationDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showDurationDropdown && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200">
                    {[
                      { value: 30, label: '1 month (30 days)' },
                      { value: 60, label: '2 months (60 days)' },
                      { value: 90, label: '3 months (90 days)' },
                      { value: 120, label: '4 months (120 days)' },
                      { value: 150, label: '5 months (150 days)' },
                      { value: 180, label: '6 months (180 days)' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, durationDays: option.value }));
                          setShowDurationDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 pl-6 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.durationDays && (
                <p className="mt-1 text-sm text-red-600">{errors.durationDays}</p>
              )}
            </div>
          </div>

          {/* Vehicle Type and Material Type in one row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vehicle Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVehicleTypeDropdown(!showVehicleTypeDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"

                >
                  <span>{formData.vehicleType || 'Select Vehicle Type'}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${showVehicleTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showVehicleTypeDropdown && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                    {getAvailableVehicleTypes().map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, vehicleType: type }));
                          setShowVehicleTypeDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 pl-6 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.vehicleType && (
                <p className="mt-1 text-sm text-red-600">{errors.vehicleType}</p>
              )}
            </div>

            {/* Material Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => formData.vehicleType && setShowMaterialTypeDropdown(!showMaterialTypeDropdown)}
                  disabled={!formData.vehicleType}
                  className={`flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2 ${
                    !formData.vehicleType ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                >
                  <span className={!formData.vehicleType ? 'text-gray-400' : ''}>
                    {formData.materialType || 'Select Material Type'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${showMaterialTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showMaterialTypeDropdown && formData.vehicleType && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
                    {getAvailableMaterialTypes().map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, materialType: type }));
                          setShowMaterialTypeDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 pl-6 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!formData.vehicleType && (
                <p className="mt-1 text-sm text-gray-500">Please select vehicle type first</p>
              )}
              {errors.materialType && (
                <p className="mt-1 text-sm text-red-600">{errors.materialType}</p>
              )}
            </div>
          </div>

          {/* Type Change Warning */}
          {(formData.materialType !== ad.materialType || formData.vehicleType !== ad.vehicleType) && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900">Ad Type Changed</p>
                <p className="text-sm text-orange-700 mt-1">
                  Changing vehicle or material type will release current device slots and find new compatible devices. The ad will require admin re-approval.
                </p>
              </div>
            </div>
          )}

          {/* Advertisement Length, Number of Devices, and Campaign Duration in one row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ad Length Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advertisement Length
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAdLengthDropdown(!showAdLengthDropdown)}
                  className="flex items-center justify-between w-full text-xs text-black rounded-md pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white/70 gap-2"

                >
                  <span>{formData.adLengthSeconds} seconds</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transform transition-transform ${showAdLengthDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showAdLengthDropdown && (
                  <div className="absolute z-50 mt-2 w-full bg-white rounded-md shadow-lg border border-gray-200">
                    {[20, 40, 60].map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, adLengthSeconds: seconds }));
                          setShowAdLengthDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 pl-6 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {seconds} seconds
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.adLengthSeconds && (
                <p className="mt-1 text-sm text-red-600">{errors.adLengthSeconds}</p>
              )}
            </div>

            {/* Number of Devices */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Devices
              </label>
              <input
                type="number"
                min="1"
                max={pricingCalculation?.maxDevices || 10}
                value={formData.numberOfDevices}
                onChange={(e) => setFormData(prev => ({ ...prev, numberOfDevices: parseInt(e.target.value) || 1 }))}
                className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-blue-500"
              />
              {pricingCalculation && (
                <p className="mt-1 text-sm text-gray-600">
                  Max: {pricingCalculation.maxDevices}
                </p>
              )}
              {errors.numberOfDevices && (
                <p className="mt-1 text-sm text-red-600">{errors.numberOfDevices}</p>
              )}
            </div>
          </div>

          {/* Price Calculation Display */}
          {isCalculating ? (
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
              <span className="text-gray-600">Calculating price...</span>
            </div>
          ) : pricingCalculation ? (
            <div className="p-6 rounded-md">
              <div className="flex items-center gap-2 mb-4">
                <h4 className="font-bold text-lg text-gray-900">New Campaign Price</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plays Per Day:</span>
                  <span className="font-medium text-gray-900">{pricingCalculation.totalPlaysPerDay} plays</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Revenue:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(pricingCalculation.dailyRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium text-gray-900">{getDurationLabel(formData.durationDays)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Devices:</span>
                  <span className="font-medium text-gray-900">{formData.numberOfDevices}</span>
                </div>
                <div className="flex justify-end text-2xl font-bold mb-4">
                  {formatCurrency(pricingCalculation.totalPrice)}
                </div>
              </div>
            </div>
          ) : null}

          {/* Price Change Warning */}
          {pricingCalculation && Math.abs(pricingCalculation.totalPrice - ad.price) > 0.01 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Price Update Notice</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Changing campaign settings will update the price from {formatCurrency(ad.price)} to {formatCurrency(pricingCalculation.totalPrice)}. This change requires re-approval from admin.
                </p>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-4 ">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploading || updating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || updating}
              className="px-10 py-2 bg-[#3674B5] text-white rounded-md hover:shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(uploading || updating) && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? 'Uploading...' : updating ? 'Updating...' : 'Update Advertisement'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};

export default EditAdModal;

