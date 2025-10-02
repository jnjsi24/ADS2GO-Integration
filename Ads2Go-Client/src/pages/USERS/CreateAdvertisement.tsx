import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import { ChevronLeft, ChevronRight, ClockFading, CalendarPlus, Upload, Calendar, DollarSign, Play, ChevronDown, CloudUpload } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { CREATE_FLEXIBLE_AD } from '../../graphql/mutations/flexibleAdMutations';
import { 
  GET_FLEXIBLE_FIELD_COMBINATIONS, 
  CALCULATE_FLEXIBLE_PRICING,
  FlexiblePricingCalculation 
} from '../../graphql/queries/flexibleAdQueries';
import { uploadFileToFirebase } from '../../utils/fileUpload';

type VehicleType = 'CAR' | 'MOTORCYCLE' | '';
type MaterialCategory = 'DIGITAL' | 'NON-DIGITAL';

type AdvertisementForm = {
  title: string;
  description: string;
  website: string;
  materialType: string;
  vehicleType: VehicleType;
  category: MaterialCategory;
  durationDays: number;
  adLengthSeconds: number;
  numberOfDevices: number;
  startDate: string;
  mediaFile: File | null;
};

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmissionInProgress, setIsSubmissionInProgress] = useState(false);
  const [pricingCalculation, setPricingCalculation] = useState<FlexiblePricingCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showVehicleTypeDropdown, setShowVehicleTypeDropdown] = useState(false);
  const [showMaterialTypeDropdown, setShowMaterialTypeDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showAdLengthDropdown, setShowAdLengthDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaFileError, setMediaFileError] = useState<string>('');


  // Form data
  const [formData, setFormData] = useState<AdvertisementForm>({
    title: '',
    description: '',
    website: '',
    materialType: '',
    vehicleType: '',
    category: 'DIGITAL',
    durationDays: 30,
    adLengthSeconds: 20,
    numberOfDevices: 1,
    startDate: '',
    mediaFile: null
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // GraphQL Hooks
  const { data: fieldCombinationsData, loading: fieldCombinationsLoading } = useQuery(GET_FLEXIBLE_FIELD_COMBINATIONS);
  const [calculatePricing] = useLazyQuery(CALCULATE_FLEXIBLE_PRICING);
  const [createAd] = useMutation(CREATE_FLEXIBLE_AD, {
    onCompleted: () => {
      setShowToast({ message: 'Advertisement created successfully! Redirecting...', type: 'success' });
      setTimeout(() => {
        setShowToast(null);
        navigate('/advertisements');
      }, 5000); // Changed to 10 seconds
    },
    onError: (error) => {
      console.error('Error creating ad:', error);
      setShowToast({ message: error.message, type: 'error' });
      setTimeout(() => setShowToast(null), 5000); // Clear toast after 10 seconds
    }
  });

  const fieldCombinations = fieldCombinationsData?.getFlexibleFieldCombinations || [];

  // Auto-calculate pricing when form data changes
  useEffect(() => {
    if (formData.materialType && formData.vehicleType && formData.category) {
      calculatePricingAsync();
    }
  }, [formData.materialType, formData.vehicleType, formData.category, formData.durationDays, formData.adLengthSeconds, formData.numberOfDevices]);

  // Reset materialType when vehicleType changes to MOTORCYCLE or is cleared
  useEffect(() => {
    if (formData.vehicleType === 'MOTORCYCLE' && formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, materialType: '' }));
    } else if (!formData.vehicleType) {
      setFormData(prev => ({ ...prev, materialType: '' }));
    }
  }, [formData.vehicleType]);

  // Auto-determine category based on material type
  useEffect(() => {
    if (formData.materialType === 'LCD' || formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    }
  }, [formData.materialType]);

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

  // Ensure category is set before form submission
  const ensureCategoryIsSet = () => {
    if (formData.materialType && !formData.category) {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
      return false; // Category was missing, need to wait for state update
    }
    return true; // Category is set
  };

  // Get available material types
  const getAvailableMaterialTypes = (): string[] => {
    if (!formData.vehicleType) {
      return [];
    }
    if (formData.vehicleType === 'MOTORCYCLE') {
      return ['LCD'];
    }
    const combinations = fieldCombinations.filter((combo: any) => 
      combo.vehicleType === formData.vehicleType && combo.isActive
    );
    return Array.from(new Set(combinations.map((combo: any) => combo.materialType))) as string[];
  };

  // Get max devices for selected combination
  const getMaxDevices = () => {
    const combination = fieldCombinations.find((combo: any) => 
      combo.materialType === formData.materialType && 
      combo.vehicleType === formData.vehicleType && 
      combo.category === formData.category &&
      combo.isActive
    );
    return combination?.maxDevices || 1;
  };

  // Get ad length limits
  const getAdLengthLimits = () => {
    const combination = fieldCombinations.find((combo: any) => 
      combo.materialType === formData.materialType && 
      combo.vehicleType === formData.vehicleType && 
      combo.category === formData.category &&
      combo.isActive
    );
    return {
      min: combination?.minAdLengthSeconds || 5,
      max: combination?.maxAdLengthSeconds || 60
    };
  };

  const handleInputChange = (field: keyof AdvertisementForm, value: string | number | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.title.trim()) newErrors.title = 'Title is required';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
      if (!formData.materialType) newErrors.materialType = 'Material type is required';
      if (!formData.vehicleType) newErrors.vehicleType = 'Vehicle type is required';
      if (!formData.category) newErrors.category = 'Category is required';
      if (!formData.mediaFile) newErrors.mediaFile = 'Media file is required';
    } else if (step === 2) {
      if (!formData.startDate) newErrors.startDate = 'Start date is required';
      // Validate ad length - only allow 20, 40, or 60 seconds
      const allowedAdLengths = [20, 40, 60];
      if (!allowedAdLengths.includes(formData.adLengthSeconds)) {
        newErrors.adLengthSeconds = 'Ad length must be 20, 40, or 60 seconds';
      }
      // Validate duration - only allow 1-6 months (30-180 days)
      const allowedDurations = [30, 60, 90, 120, 150, 180];
      if (!allowedDurations.includes(formData.durationDays)) {
        newErrors.durationDays = 'Duration must be 1-6 months (30-180 days)';
      }
      // Validate number of devices
      const maxDevices = getMaxDevices();
      if (formData.numberOfDevices > maxDevices) {
        newErrors.numberOfDevices = `Maximum ${maxDevices} devices allowed`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(3, prev + 1));
    } else {
      setShowToast({ message: 'Please complete all required information.', type: 'error' });
      setTimeout(() => setShowToast(null), 5000); // Clear toast after 10 seconds
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure category is set before validation
    if (!ensureCategoryIsSet()) {
      console.log('Category was missing, waiting for state update...');
      setTimeout(() => handleSubmit(e), 100);
      return;
    }
    
    if (!validateStep(2) || !validateStep(1)) {
      setShowToast({ message: 'Please fix the errors before submitting.', type: 'error' });
      setTimeout(() => setShowToast(null), 5000); // Clear toast after 10 seconds
      return;
    }
    if (!pricingCalculation) {
      setShowToast({ message: 'Please wait for pricing calculation to complete.', type: 'error' });
      setTimeout(() => setShowToast(null), 5000); // Clear toast after 10 seconds
      return;
    }

    setIsSubmissionInProgress(true);

    try {
      // Upload media file to Firebase
      setIsUploading(true);
      const mediaFileURL = await uploadMediaFile(formData.mediaFile!);
      setIsUploading(false);
      
      // Parse start date
      const [year, month, day] = formData.startDate.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const startTime = startDate.toISOString();
      
      // Calculate end date
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + formData.durationDays);
      endDate.setUTCHours(23, 59, 59, 999);
      const endTime = endDate.toISOString();
      
      // Create ad with ensured category
      const input = {
        title: formData.title,
        description: formData.description,
        website: formData.website || null,
        materialType: formData.materialType,
        vehicleType: formData.vehicleType,
        category: formData.category || 'DIGITAL',
        durationDays: formData.durationDays,
        adLengthSeconds: formData.adLengthSeconds,
        numberOfDevices: formData.numberOfDevices,
        price: pricingCalculation.totalPrice,
        adType: formData.category || 'DIGITAL',
        adFormat: formData.mediaFile?.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        status: 'PENDING',
        startTime: startTime,
        endTime: endTime,
        mediaFile: mediaFileURL
      };
      
      console.log('Submitting ad with configuration:', {
        materialType: input.materialType,
        vehicleType: input.vehicleType,
        category: input.category
      });
      
      await createAd({ variables: { input } });
    } catch (error) {
      console.error('Error creating ad:', error);
      setShowToast({ message: 'Failed to create advertisement. Please try again.', type: 'error' });
    } finally {
      setIsSubmissionInProgress(false);
      setIsUploading(false);
    }
  };

  // Upload media file to Firebase Storage
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Update the handleFileInputChange function to be more strict
const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0] || null;
  
  // Clear previous errors
  setMediaFileError('');
  
  if (file) {
    // More specific validation for supported types
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    // List of specific supported MIME types
    const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const supportedVideoTypes = ['video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime'];
    
    const isSupportedImage = supportedImageTypes.includes(file.type);
    const isSupportedVideo = supportedVideoTypes.includes(file.type);
    
    if ((isImage && isSupportedImage) || (isVideo && isSupportedVideo)) {
      handleInputChange('mediaFile', file);
    } else {
      setMediaFileError('Invalid file type. Supported: JPEG, PNG, GIF, WebP, MP4, MPEG, OGG, WebM, MOV');
      // Clear the file input
      e.target.value = '';
      handleInputChange('mediaFile', null);
    }
  } else {
    handleInputChange('mediaFile', null);
  }
};

// Also update the handleDrop function to be more specific
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsDragging(false);
  const file = e.dataTransfer.files[0];
  
  // Clear previous errors
  setMediaFileError('');
  
  if (file) {
    // More specific validation for supported types
    const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const supportedVideoTypes = ['video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime'];
    
    const isSupportedImage = supportedImageTypes.includes(file.type);
    const isSupportedVideo = supportedVideoTypes.includes(file.type);
    
    if (isSupportedImage || isSupportedVideo) {
      handleInputChange('mediaFile', file);
    } else {
      setMediaFileError('Invalid file type. Supported: JPEG, PNG, GIF, WebP, MP4, MPEG, OGG, WebM, ');
      handleInputChange('mediaFile', null);
    }
  }
};

  const renderStep1 = () => (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6 text-center">Advertisement Details</h1>
      <div className="space-y-6">
        <div className="relative w-full">
          <input
            type="text"
            id="adTitle"
            placeholder=""
            required
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent 
              focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition
              ${errors.title ? 'border-red-400' : 'border-gray-300'}`}
            style={{ backgroundColor: 'transparent' }}
          />
          <label
            htmlFor="adTitle"
            className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200
              ${formData.title
                ? '-top-2 text-sm text-gray-700 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400'}
              peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
          >
            Advertisement Title
          </label>
          {errors.title && (
            <p className="text-sm text-red-600 mt-1">{errors.title}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Description 
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full p-3 bg-gray-50 border-b border-gray-300 focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition h-28"
            placeholder="Describe your advertisement"
            required
          />
          {errors.description && (
            <p className="text-sm text-red-600 mt-1">{errors.description}</p>
          )}
        </div>
        <div className="relative w-full">
          <input
            type="url"
            id="websiteUrl"
            placeholder=""
            value={formData.website}
            onChange={(e) => handleInputChange('website', e.target.value)}
            className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent 
              focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition
              ${errors.website ? 'border-red-400' : 'border-gray-300'}`}
            style={{ backgroundColor: 'transparent' }}
          />
          <label
            htmlFor="websiteUrl"
            className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200
              ${formData.website
                ? '-top-2 text-sm text-gray-700 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400'}
              peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
          >
            Website URL (Optional)
          </label>
          {errors.website && (
            <p className="text-sm text-red-600 mt-1">{errors.website}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Media File
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
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.ogg,.webm,.mov,image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/ogg,video/webm,video/quicktime"
              onChange={handleFileInputChange}
              className="hidden"
              id="media-upload"
              required
            />
            {formData.mediaFile && !mediaFileError && (
              <p className="text-sm text-green-600 mt-2">
                Selected: {formData.mediaFile.name}
              </p>
            )}
          </div>
          {/* Show validation errors from form validation OR media file error */}
          {(errors.mediaFile || mediaFileError) && (
            <p className="text-sm text-red-600 mt-1">
              {mediaFileError || errors.mediaFile}
            </p>
          )}
        </div>
      </div>
      {fieldCombinationsLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading configurations...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-3 mt-5">
                Vehicle Type
              </label>
              <button
                type="button"
                onClick={() => setShowVehicleTypeDropdown(!showVehicleTypeDropdown)}
                className="flex items-center bg-white justify-between w-full text-sm text-black rounded-lg pl-6 pr-4 py-5 shadow-md focus:outline-none gap-2"
              >
                {formData.vehicleType ? formData.vehicleType : 'Select Vehicle Type'}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    showVehicleTypeDropdown ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>
              <AnimatePresence>
                {showVehicleTypeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    <button
                      key="select-vehicle-type"
                      type="button"
                      onClick={() => {
                        handleInputChange('vehicleType', '');
                        setShowVehicleTypeDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      Select Vehicle Type
                    </button>
                    {['CAR', 'MOTORCYCLE'].map((vehicleType) => (
                      <button
                        key={vehicleType}
                        type="button"
                        onClick={() => {
                          handleInputChange('vehicleType', vehicleType as VehicleType);
                          setShowVehicleTypeDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {vehicleType}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {errors.vehicleType && (
                <p className="text-sm text-red-600 mt-1">{errors.vehicleType}</p>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm font-bold text-gray-700 mb-3 mt-5">
                Material Type
              </label>
              <button
                type="button"
                onClick={() =>
                  formData.vehicleType && setShowMaterialTypeDropdown(!showMaterialTypeDropdown)
                }
                className={`flex items-center justify-between w-full text-sm rounded-lg pl-6 pr-4 py-5 shadow-md focus:outline-none bg-white gap-2 ${
                  formData.vehicleType
                    ? 'text-black cursor-pointer'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                disabled={!formData.vehicleType}
              >
                {formData.materialType ? formData.materialType : 'Select Material Type'}
                <ChevronDown
                  size={16}
                  className={`transform transition-transform duration-200 ${
                    showMaterialTypeDropdown ? 'rotate-180' : 'rotate-0'
                  } ${formData.vehicleType ? 'text-black' : 'text-gray-400'}`}
                />
              </button>
              <AnimatePresence>
                {showMaterialTypeDropdown && formData.vehicleType && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                  >
                    {getAvailableMaterialTypes().map((materialType, index) => (
                      <button
                        key={`material-${materialType}-${index}`}
                        type="button"
                        onClick={() => {
                          handleInputChange('materialType', materialType);
                          setShowMaterialTypeDropdown(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      >
                        {materialType}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {errors.materialType && (
                <p className="text-sm text-red-600 mt-1">{errors.materialType}</p>
              )}
            </div>
          </div>
          {formData.materialType && formData.vehicleType && (
            <div className="bg-yellow-50 rounded-xl p-4">
              <h3 className="font-medium text-black/80 mb-4">Selected Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
                <div className="space-y-2">
                  <p><strong>Vehicle:</strong> {formData.vehicleType}</p>
                  <p><strong>Material:</strong> {formData.materialType}</p>
                  <p><strong>Category:</strong> {formData.category}</p>
                </div>
                <div className="space-y-2">
                  <p>
                    <strong>Available Devices:</strong>{" "}
                    {pricingCalculation?.availableDevices ||
                      (isCalculating ? "⏳ Calculating..." : "⏳ Loading...")}
                  </p>
                  <p><strong>Ad Length Options:</strong> 20s, 40s, or 60s</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-center">Campaign Settings</h2>
      <div className="space-y-6">
        <div className="relative">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Campaign Duration
          </label>
          <button
            type="button"
            onClick={() => setShowDurationDropdown(!showDurationDropdown)}
            className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-6 pr-4 py-5 shadow-md focus:outline-none bg-white gap-2 cursor-pointer"
          >
            {formData.durationDays
              ? `${
                  formData.durationDays === 30 ? '1 month (30 days)' :
                  formData.durationDays === 60 ? '2 months (60 days)' :
                  formData.durationDays === 90 ? '3 months (90 days)' :
                  formData.durationDays === 120 ? '4 months (120 days)' :
                  formData.durationDays === 150 ? '5 months (150 days)' :
                  formData.durationDays === 180 ? '6 months (180 days)' :
                  `${formData.durationDays} days`
                }`
              : 'Select Duration'}
            <ChevronDown
              size={16}
              className={`transform transition-transform duration-200 ${
                showDurationDropdown ? 'rotate-180' : 'rotate-0'
              } text-black`}
            />
          </button>
          <AnimatePresence>
            {showDurationDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute z-10 top-24 w-full rounded-lg shadow-lg bg-white overflow-hidden"
              >
                <button
                  key="select-duration"
                  type="button"
                  onClick={() => {
                    handleInputChange('durationDays', '');
                    setShowDurationDropdown(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                >
                  Select Duration
                </button>
                {[
                  { value: 30, label: '1 month (30 days)' },
                  { value: 60, label: '2 months (60 days)' },
                  { value: 90, label: '3 months (90 days)' },
                  { value: 120, label: '4 months (120 days)' },
                  { value: 150, label: '5 months (150 days)' },
                  { value: 180, label: '6 months (180 days)' }
                ].map((option) => (
                  <button
                    key={`duration-${option.value}`}
                    type="button"
                    onClick={() => {
                      handleInputChange('durationDays', option.value);
                      setShowDurationDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-sm text-gray-500 mt-1">
            Choose from 1 to 6 months duration
          </p>
          {errors.durationDays && (
            <p className="text-sm text-red-600 mt-1">{errors.durationDays}</p>
          )}
        </div>
        <div className="relative">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Advertisement Length 
          </label>
          <button
            type="button"
            onClick={() => setShowAdLengthDropdown(!showAdLengthDropdown)}
            className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-6 pr-4 py-5 shadow-md focus:outline-none bg-white gap-2 cursor-pointer"
          >
            {formData.adLengthSeconds
              ? `${formData.adLengthSeconds} seconds`
              : 'Select Ad Length'}
            <ChevronDown
              size={16}
              className={`transform transition-transform duration-200 ${
                showAdLengthDropdown ? 'rotate-180' : 'rotate-0'
              } text-black`}
            />
          </button>
          <AnimatePresence>
            {showAdLengthDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute z-10 top-24 w-full rounded-lg shadow-lg bg-white overflow-hidden"
              >
                <button
                  key="select-ad-length"
                  type="button"
                  onClick={() => {
                    handleInputChange('adLengthSeconds', '');
                    setShowAdLengthDropdown(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                >
                  Select Ad Length
                </button>
                {[
                  { value: 20, label: '20 seconds' },
                  { value: 40, label: '40 seconds' },
                  { value: 60, label: '60 seconds' }
                ].map((option) => (
                  <button
                    key={`ad-length-${option.value}`}
                    type="button"
                    onClick={() => {
                      handleInputChange('adLengthSeconds', option.value);
                      setShowAdLengthDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-sm text-gray-500 mt-1">
            Choose from: 20, 40, or 60 seconds
          </p>
          {errors.adLengthSeconds && (
            <p className="text-sm text-red-600 mt-1">{errors.adLengthSeconds}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Number of Devices
          </label>
          <input
            type="number"
            min="1"
            max={getMaxDevices()}
            value={formData.numberOfDevices}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              handleInputChange('numberOfDevices', isNaN(value) ? 1 : value);
            }}
            className="w-full p-3 border-b border-gray-300 bg-gray-50 focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum: {getMaxDevices()} devices
          </p>
          {errors.numberOfDevices && (
            <p className="text-sm text-red-600 mt-1">{errors.numberOfDevices}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Campaign Start Date
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => handleInputChange('startDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-3 shadow-md rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            required
          />
          {errors.startDate && (
            <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-10 text-center">Pricing & Summary</h2>
      <div className="mt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* LEFT COLUMN - Media preview + filename */}
          <div className="flex flex-col">
            {/* Media Preview - Matches right column height */}
            <div className="w-full bg-gray-100 border rounded-lg overflow-hidden flex items-center justify-center min-h-40">
              {formData.mediaFile ? (
                formData.mediaFile.type.startsWith("image/") ? (
                  <img 
                    src={URL.createObjectURL(formData.mediaFile)} 
                    alt="Media Preview" 
                    className="object-contain w-full h-full max-h-64" 
                  />
                ) : (
                  <video 
                    src={URL.createObjectURL(formData.mediaFile)} 
                    controls 
                    className="object-contain w-full h-full max-h-64" 
                  />
                )
              ) : (
                <span className="text-gray-400 text-sm">No Media Selected</span>
              )}
            </div>
            
            {/* File Name */}
            <span className="mt-3 text-sm font-medium text-gray-700 text-center">
              {formData.mediaFile?.name || "Not selected"}
            </span>
          </div>

          {/* RIGHT COLUMN - Campaign Details */}
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="font-bold text-2xl">
                {formData.title || "Not specified"}
              </span>
            </div>
            
            {/* Description with fixed height and scroll */}
            <div className="flex justify-between">
              <div className="max-h-32 overflow-y-auto w-full">
                <span className="text-gray-600">
                  {formData.description || "Not specified"}
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center text-black">
                <ClockFading className="w-4 h-4 mr-1 text-blue-500" />
                <span className="">{formData.durationDays} days</span>
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center text-black">
                <CalendarPlus className="w-4 h-4 mr-1 text-green-500" />
                {formData.startDate || "Not specified"}
              </span>
            </div>
          </div>
        </div>
      </div>
      {isCalculating ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calculating pricing...</p>
        </div>
      ) : pricingCalculation ? (
        <div className="bg-gray-50 rounded-xl p-6 mb-6 mt-6">
          <h3 className="text-xl font-semibold text-center text-gray-900 mb-4">Pricing Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Configuration:</span>
              <span className="font-medium">{pricingCalculation.materialType} {pricingCalculation.vehicleType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">
                {pricingCalculation.durationDays === 30 ? '1 month' :
                 pricingCalculation.durationDays === 60 ? '2 months' :
                 pricingCalculation.durationDays === 90 ? '3 months' :
                 pricingCalculation.durationDays === 120 ? '4 months' :
                 pricingCalculation.durationDays === 150 ? '5 months' :
                 pricingCalculation.durationDays === 180 ? '6 months' :
                 `${pricingCalculation.durationDays} days`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ad Length:</span>
              <span className="font-medium">{pricingCalculation.adLengthSeconds} seconds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Devices:</span>
              <span className="font-medium">{pricingCalculation.numberOfDevices} device/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Device play/day:</span>
              <span className="font-medium">{pricingCalculation.playsPerDayPerDevice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total plays/day:</span>
              <span className="font-medium">{pricingCalculation.totalPlaysPerDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Price/play:</span>
              <span className="font-medium">{formatCurrency(pricingCalculation.pricePerPlay)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Daily revenue:</span>
              <span className="font-medium">{formatCurrency(pricingCalculation.dailyRevenue)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between font-bold">
                <span>Total Price:</span>
                <span className="text-xl text-blue-600">{formatCurrency(pricingCalculation.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Please complete the previous steps to see pricing</p>
        </div>
      )}
    </div>
  );

  const steps = [
    { number: 1, title: 'Details', icon: Play },
    { number: 2, title: 'Settings', icon: Calendar },
    { number: 3, title: 'Pricing', icon: DollarSign }
  ];

  return (
    <div className="min-h-screen pl-72 bg-gray-50">
      <button
        onClick={() => navigate('/advertisements')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 pt-10"
      >
        <ChevronLeft className="w-5 h-5" />
        Back to Advertisement
      </button>
      <div>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Create Advertisement</h2>
          </div>
        </div>
      </div>
      <div>
        <div className="max-w-sm mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <div key={step.number} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isActive
                        ? "border-blue-500 bg-blue-500 text-white"
                        : isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 bg-white text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <span className="text-sm font-bold">✓</span>
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="ml-2">
                    <p
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-blue-600"
                          : isCompleted
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-10 h-0.5 mx-2 ${
                        isCompleted ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-2 mr-7 px-6 bg-[#3674B5] hover:bg-[#1B5087] text-white rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="flex flex-col items-end space-y-2">
                {isCalculating && (
                  <p className="text-sm text-blue-600">Calculating pricing...</p>
                )}
                {!pricingCalculation && !isCalculating && (
                  <p className="text-sm text-red-600">Pricing calculation failed. Please try again.</p>
                )}
                <button
                  type="submit"
                  disabled={isSubmissionInProgress}
                  className="px-8 py-3 bg-[#3674B5] hover:bg-[#1B5087] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : isSubmissionInProgress ? 'Creating...' : 'Create Advertisement'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            className={`fixed bottom-4 right-4 px-6 py-3 z-50 rounded-md ${
              showToast.type === 'error' 
                ? 'text-red-600 bg-red-100' 
                : 'text-green-600 bg-green-100'
            }`}
          >
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateAdvertisement;