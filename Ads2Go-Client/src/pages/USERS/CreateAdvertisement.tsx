import { useState, useEffect,  MouseEvent } from 'react';
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
import { useToast, ToastContainer } from '../../components/ToastNotification';
import CalendarWidget from '../../components/CalendarWidget';
import { GET_MY_ADS } from '../../graphql/user/queries/getMyAds';

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
  const { toasts, addToast, removeToast } = useToast();
  const [isSubmissionInProgress, setIsSubmissionInProgress] = useState(false);
  const [pricingCalculation, setPricingCalculation] = useState<FlexiblePricingCalculation | null>(null);
  const [pricingCalculationError, setPricingCalculationError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showVehicleTypeDropdown, setShowVehicleTypeDropdown] = useState(false);
  const [showMaterialTypeDropdown, setShowMaterialTypeDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [showAdLengthDropdown, setShowAdLengthDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mediaFileError, setMediaFileError] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detectedVideoDuration, setDetectedVideoDuration] = useState<number | null>(null);
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);


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
    refetchQueries: [{ query: GET_MY_ADS }],
    onCompleted: () => {
      addToast({ 
        title: 'Success!', 
        message: 'Advertisement created successfully! Redirecting...', 
        type: 'success' 
      });
      setTimeout(() => {
        navigate('/advertisements');
      }, 2000);
    },
    onError: (error) => {
      console.error('Error creating ad:', error);
      addToast({ 
        title: 'Error!', 
        message: error.message, 
        type: 'error' 
      });
    }
  });

  const fieldCombinations = fieldCombinationsData?.getFlexibleFieldCombinations || [];

  // Auto-calculate pricing when form data changes
  useEffect(() => {
    // ✅ Only calculate pricing if all required fields are valid
    const allowedAdLengths = [20, 40, 60];
    if (formData.materialType && 
        formData.vehicleType && 
        formData.category && 
        allowedAdLengths.includes(formData.adLengthSeconds)) {
      calculatePricingAsync();
    } else {
      // Clear pricing and error if required fields are not valid
      setPricingCalculation(null);
      setPricingCalculationError(null);
    }
  }, [formData.materialType, formData.vehicleType, formData.category, formData.durationDays, formData.adLengthSeconds, formData.numberOfDevices]);

  // No re-validation needed in Step 1 - we auto-select the recommended length

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
    setPricingCalculationError(null); // Clear previous errors
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
        setPricingCalculationError(null); // Clear error on success
      }
    } catch (error: any) {
      console.error('Error calculating pricing:', error);
      setPricingCalculation(null);
      
      // Extract error message
      const errorMessage = error?.message || error?.graphQLErrors?.[0]?.message || 'Failed to calculate pricing. Please try again.';
      
      // Check if it's a missing pricing configuration error
      if (errorMessage.includes('No pricing configuration found')) {
        setPricingCalculationError(`⚠️ ${errorMessage}. Please contact the administrator to set up pricing for this configuration.`);
      } else {
        setPricingCalculationError(`❌ ${errorMessage}`);
      }
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

  // Get max devices - now only limited by available devices (not pricing config limit)
  const getMaxDevices = () => {
    // ✅ Constraint is now based on available materials only, not a pricing config limit
    // Number of vehicles is just a multiplier in the pricing calculation
    if (pricingCalculation?.availableDevices !== undefined) {
      return pricingCalculation.availableDevices;
    }
    
    // Default to 1 if no calculation available yet
    return 1;
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

  // Helper function to detect video duration from File
  const detectVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        // ✅ Use Math.round for accurate rounding (20.1s → 20s, 20.6s → 21s)
        const duration = Math.round(video.duration);
        console.log(`📹 Raw video duration: ${video.duration}s, Rounded: ${duration}s`);
        resolve(duration);
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // Helper function to get recommended ad length based on video duration
  // Match the NEW backend validation logic:
  // - 20s ad length: accepts videos 1-20 seconds
  // - 40s ad length: accepts videos 21-40 seconds
  // - 60s ad length: accepts videos 41-60 seconds
  const getRecommendedAdLength = (videoDuration: number): number => {
    if (videoDuration <= 20) return 20;  // 1-20s → 20s ad
    if (videoDuration <= 40) return 40;  // 21-40s → 40s ad
    return 60;                            // 41-60s → 60s ad
  };

  const handleInputChange = async (field: keyof AdvertisementForm, value: string | number | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // If uploading a video file, detect its duration
    if (field === 'mediaFile' && value instanceof File && value.type.startsWith('video/')) {
      setIsDetectingDuration(true);
      setDetectedVideoDuration(null);
      setMediaFileError('');
      
      try {
        const duration = await detectVideoDuration(value);
        setDetectedVideoDuration(duration);
        console.log(`✅ Detected video duration: ${duration}s`);
        
        // ✅ NEW: Auto-select recommended ad length based on detected duration
        const recommendedLength = getRecommendedAdLength(duration);
        setFormData(prev => ({ ...prev, adLengthSeconds: recommendedLength }));
        console.log(`✅ Auto-selected recommended ad length: ${recommendedLength}s for ${duration}s video`);
        
        // No validation in Step 1 - just detect and recommend
      } catch (error) {
        console.error('Failed to detect video duration:', error);
        setMediaFileError('Failed to detect video duration. Please try a different file.');
      } finally {
        setIsDetectingDuration(false);
      }
    } else if (field === 'mediaFile' && !value) {
      // Clear video duration when file is removed
      setDetectedVideoDuration(null);
      setMediaFileError('');
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Calendar handlers
  const handleCalendarDateSelect = (date: Date | null) => {
    setSelectedDate(date);
    if (date) {
      // Format date using local timezone to avoid date shift
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      setFormData(prev => ({ ...prev, startDate: dateString }));
      // Clear any existing startDate error when a valid date is selected
      if (errors.startDate) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.startDate;
          return newErrors;
        });
      }
    } else {
      setFormData(prev => ({ ...prev, startDate: '' }));
    }
    setShowCalendar(false);
  };

  const toggleCalendar = () => {
    // Clear any existing startDate error when opening the calendar
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.startDate;
      return newErrors;
    });
    setShowCalendar(!showCalendar);
  };

  // Sync selectedDate with formData.startDate
  useEffect(() => {
    if (formData.startDate) {
      const date = new Date(formData.startDate);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
      }
    } else {
      setSelectedDate(null);
    }
  }, [formData.startDate]);

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

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.title.trim()) newErrors.title = 'Title is required';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
      if (!formData.materialType) newErrors.materialType = 'Material type is required';
      if (!formData.vehicleType) newErrors.vehicleType = 'Vehicle type is required';
      if (!formData.category) newErrors.category = 'Category is required';
      if (!formData.mediaFile) newErrors.mediaFile = 'Media file is required';
      
      // ✅ Block if still detecting video duration
      if (isDetectingDuration) {
        newErrors.mediaFile = 'Please wait while we detect your video duration...';
      }
      
      // ✅ Block if there was an error detecting video duration
      if (mediaFileError) {
        newErrors.mediaFile = mediaFileError;
      }
    } else if (step === 2) {
      if (!formData.startDate) {
        newErrors.startDate = 'Start date is required';
      } else {
        // Validate that the start date is not in the past
        const selectedDate = new Date(formData.startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
        
        if (selectedDate < today) {
          newErrors.startDate = 'Start date cannot be in the past';
        }
      }
      // Validate ad length - only allow 20, 40, or 60 seconds
      const allowedAdLengths = [20, 40, 60];
      if (!allowedAdLengths.includes(formData.adLengthSeconds)) {
        newErrors.adLengthSeconds = 'Please select an ad length (20, 40, or 60 seconds)';
      }
      // ✅ REMOVED: Frontend validation of video duration match
      // The browser's video.duration is often inaccurate due to encoding/metadata issues
      // Let the backend (ffprobe) do the accurate validation
      
      // Validate duration - only allow 1-6 months (30-180 days)
      const allowedDurations = [30, 60, 90, 120, 150, 180];
      if (!allowedDurations.includes(formData.durationDays)) {
        newErrors.durationDays = 'Duration must be 1-6 months (30-180 days)';
      }
      // Validate number of devices - constraint based on available devices only
      if (pricingCalculation?.availableDevices !== undefined && 
          formData.numberOfDevices > pricingCalculation.availableDevices) {
        newErrors.numberOfDevices = `Only ${pricingCalculation.availableDevices} device${pricingCalculation.availableDevices === 1 ? ' is' : 's are'} currently available. Please reduce to ${pricingCalculation.availableDevices} or try a different date.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(3, prev + 1));
    } else {
      addToast({ 
        title: 'Error!', 
        message: 'Please complete all required information.', 
        type: 'error' 
      });
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
      addToast({ 
        title: 'Error!', 
        message: 'Please fix the errors before submitting.', 
        type: 'error' 
      });
      return;
    }
    if (!pricingCalculation) {
      if (pricingCalculationError) {
        addToast({ 
          title: 'Error!', 
          message: pricingCalculationError, 
          type: 'error' 
        });
      } else {
        addToast({ 
          title: 'Error!', 
          message: 'Please wait for pricing calculation to complete or check your configuration.', 
          type: 'error' 
        });
      }
      return;
    }

    setIsSubmissionInProgress(true);

    try {
      // Upload media file to Firebase
      setIsUploading(true);
      const mediaFileURL = await uploadMediaFile(formData.mediaFile!);
      setIsUploading(false);
      
      // Parse start date - ads always start at 8:00 AM Manila time (operating hours start)
      // Manila is UTC+8, so 8:00 AM Manila = 00:00 UTC
      const [year, month, day] = formData.startDate.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)); // 00:00 UTC = 8:00 AM Manila
      const startTime = startDate.toISOString();
      
      // Calculate end date - ads end at 11:59 PM Manila time (operating hours end)
      // Manila is UTC+8, so 11:59 PM Manila = 15:59 UTC (next day at 23:59 - 8 hours)
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + formData.durationDays);
      endDate.setUTCHours(15, 59, 59, 999); // 15:59 UTC = 11:59 PM Manila
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
      addToast({ 
        title: 'Error!', 
        message: 'Failed to create advertisement. Please try again.', 
        type: 'error' 
      });
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
              ${errors.title ? 'border-red-400' : 'border-black/40'}`}
            style={{ backgroundColor: 'transparent' }}
          />
          <label
            htmlFor="adTitle"
            className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200
              ${formData.title
                ? '-top-2 text-sm text-gray-700 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:font-semibold peer-placeholder-shown:text-black/80'}
              peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
          >
            Advertisement Title
          </label>
          {errors.title && (
            <p className="text-sm text-red-600 mt-1">{errors.title}</p>
          )}
        </div>
        <div className="relative w-full mt-6">
          <textarea
            id="adDescription"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder=""
            required
            className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition resize-none ${errors.description ? 'border-red-400' : 'border-black/40'}`}
            style={{ backgroundColor: 'transparent' }}
            rows={4}
          />
          <label
            htmlFor="adDescription"
            className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.description
              ? '-top-2 text-sm text-gray-700 font-bold'
              : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:font-semibold peer-placeholder-shown:text-black/80'}
              peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-bold`}
          >
            Describe your advertisement
          </label>
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
              ${errors.website ? 'border-red-400' : 'border-black/40'}`}
            style={{ backgroundColor: 'transparent' }}
          />
          <label
            htmlFor="websiteUrl"
            className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200
              ${formData.website
                ? '-top-2 text-sm text-gray-700 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:font-semibold peer-placeholder-shown:text-black/80'}
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
            className={`border-2 border-dashed rounded-md p-6 transition-colors flex flex-col items-center justify-center text-center
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
                className={`relative p-3 font-medium text-xs text-white w-40 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden group hover:scale-105 shadow-md
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

            {/* File feedback */}
            <p
              className={`text-sm mt-2 ${
                mediaFileError ? 'text-red-500' : 'text-gray-500'
              }`}
            ></p>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.ogg,.webm,.mov,image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/mpeg,video/ogg,video/webm,video/quicktime"
              onChange={handleFileInputChange}
              className="hidden"
              id="media-upload"
              required
            />

            {formData.mediaFile && !mediaFileError && !isDetectingDuration && (
              <div className="mt-4">
                {/* Media Preview */}
                <div className="w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center h-40 mb-2">
                  {formData.mediaFile.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(formData.mediaFile)}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <video
                      src={URL.createObjectURL(formData.mediaFile)}
                      className="max-h-full max-w-full"
                      controls
                    />
                  )}
                </div>
                <p className="text-sm text-green-600 text-center font-medium">
                  ✓ Selected: {formData.mediaFile.name}
                </p>
                {detectedVideoDuration !== null && (
                  <>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      Note: This is an estimate. Final validation will occur when creating the ad.
                    </p>
                  </>
                )}
              </div>
            )}
            
            {isDetectingDuration && (
              <p className="text-sm text-blue-600 mt-2 animate-pulse">
                🎬 Detecting video duration...
              </p>
            )}
          </div>

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
                className="flex items-center bg-white/70 justify-between w-full text-sm text-black rounded-md pl-6 pr-4 py-4 shadow-md focus:outline-none gap-2"
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
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
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
                className={`flex items-center justify-between w-full text-sm rounded-md pl-6 pr-4 py-4 shadow-md focus:outline-none bg-white/70 gap-2 ${
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
                    className="absolute z-10 top-full mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
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
            className="flex items-center justify-between rounded-md w-full text-sm text-black pl-6 pr-4 py-4 shadow-md focus:outline-none bg-white/70 gap-2 cursor-pointer"
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
                className="absolute z-10 top-20 mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
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
            className="flex items-center justify-between rounded-md w-full text-sm text-black pl-6 pr-4 py-4 shadow-md focus:outline-none bg-white/70 gap-2 cursor-pointer"
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
                className="absolute z-10 top-20 mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
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
          {detectedVideoDuration !== null ? (
            <>
              {(() => {
                const allowedAdLengths = [20, 40, 60];
                // ✅ Only show validation if a valid ad length is selected
                if (!allowedAdLengths.includes(formData.adLengthSeconds)) {
                  const recommendedLength = getRecommendedAdLength(detectedVideoDuration);
                  
                  // Check if video is in a "gap" range (won't perfectly match any slot)
                  const isInGap = (detectedVideoDuration >= 26 && detectedVideoDuration <= 34) || 
                                  (detectedVideoDuration >= 46 && detectedVideoDuration <= 54);
                  
                  if (isInGap) {
                    return (
                      <div className="mt-1">
                        <p className="text-sm text-blue-600 font-medium">
                          ✨ Recommended: {recommendedLength} seconds (based on your ~{detectedVideoDuration}s video)
                        </p>
                        <p className="text-xs text-yellow-700 mt-1 bg-yellow-50 p-2 rounded border border-yellow-200">
                          ℹ️ Note: Frontend detection is approximate. Your video will be validated by the server when creating the ad.
                          Accepted ranges: 20s slot (15-25s), 40s slot (35-45s), 60s slot (55-65s).
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <p className="text-sm text-blue-600 mt-1 font-medium">
                      ✨ Recommended: {recommendedLength} seconds (based on your ~{detectedVideoDuration}s video)
                    </p>
                  );
                }
                
                const tolerance = 5;
                const minAllowed = formData.adLengthSeconds - tolerance;
                const maxAllowed = formData.adLengthSeconds + tolerance;
                const isMatch = detectedVideoDuration >= minAllowed && detectedVideoDuration <= maxAllowed;
                const recommendedLength = getRecommendedAdLength(detectedVideoDuration);
                
                if (isMatch) {
                  return (
                    <div>
                      <p className="text-sm text-green-600 mt-1 font-medium">
                        ✓ Your ~{detectedVideoDuration}s video should fit the {formData.adLengthSeconds}s ad slot.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Note: This is an estimate. Final validation will occur when creating the ad.
                      </p>
                    </div>
                  );
                } else {
                  return (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        ℹ️ Your video (~{detectedVideoDuration}s) may not match the selected {formData.adLengthSeconds}s ad slot.
                        Consider selecting <strong>{recommendedLength}s</strong> instead.
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        The server will validate your video when you create the ad (accepted range: {minAllowed}-{maxAllowed}s).
                      </p>
                    </div>
                  );
                }
              })()}
            </>
          ) : (
          <p className="text-sm text-gray-500 mt-1">
            Choose from: 20, 40, or 60 seconds
          </p>
          )}
          {errors.adLengthSeconds && (
            <p className="text-sm text-red-600 mt-1">{errors.adLengthSeconds}</p>
          )}
        </div>
        
        {/* Number of Devices and Campaign Start Date side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          className="w-full p-3 border-b border-black/40 focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition bg-transparent [&::-webkit-outer-spin-button]:bg-transparent [&::-webkit-outer-spin-button]:text-black [&::-webkit-inner-spin-button]:bg-transparent [&::-webkit-inner-spin-button]:text-black [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
          required
        />
        <div className="flex flex-col mt-1">
          {pricingCalculation?.availableDevices !== undefined ? (
            <p className="text-sm text-gray-500">
              {pricingCalculation.availableDevices} device{pricingCalculation.availableDevices === 1 ? '' : 's'} available
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Loading available devices...
            </p>
          )}
          {pricingCalculation?.availableDevices !== undefined && 
           pricingCalculation.availableDevices < formData.numberOfDevices && (
            <p className="text-sm font-medium text-red-500">
              Only {pricingCalculation.availableDevices} available
            </p>
          )}
        </div>
        {errors.numberOfDevices && (
          <p className="text-sm text-red-600 mt-1">{errors.numberOfDevices}</p>
        )}
      </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Campaign Start Date
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={toggleCalendar}
              className="w-full p-3 pl-1 focus:outline-none focus:ring-0 border-b border-black/40 text-left flex items-center justify-between"
            >
              <span className={selectedDate ? 'text-gray-900' : 'text-gray-500'}>
                {selectedDate 
                  ? selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  : 'Select a date'
                }
              </span>
              <Calendar className="w-4 h-4 text-black/70" />
            </button>
            
            {/* Calendar Dropdown */}
            {showCalendar && (
              <div 
                className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[9999]"
                onClick={() => setShowCalendar(false)}
              >
                <div 
                className="bg-white rounded-md shadow-2xl border border-gray-200 calendar-container mx-4 sm:ml-16"                  onClick={(e) => e.stopPropagation()}
                >
                  <CalendarWidget
                    selectedDate={selectedDate}
                    onDateSelect={handleCalendarDateSelect}
                    className="w-80"
                    minDate={new Date()}
                    showActionButtons={false}
                  />
                  <div className="flex justify-between gap-3 p-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowCalendar(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        setSelectedDate(today);
                        // Format date using local timezone to avoid date shift
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        const dateString = `${year}-${month}-${day}`;
                        setFormData(prev => ({
                          ...prev,
                          startDate: dateString
                        }));
                        setShowCalendar(false);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-[#3674B5] border border-transparent rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Today
                    </button>
                   </div>
                </div>
              </div>
            )}
          </div>
          {errors.startDate && (
            <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>
          )}
        </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-10 text-center">Pricing & Summary</h2>
      <div className="mt-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6 items-start">
          {/* LEFT COLUMN - Media preview + filename */}
          <div className="flex flex-col">
            {/* Media Preview */}
            <div className="w-full bg-white/30 overflow-hidden flex items-center justify-center min-h-40">
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
          <div className="flex flex-col justify-between h-full text-sm">
            {/* Top Section */}
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-bold text-2xl">
                  {formData.title || "Not specified"}
                </span>
              </div>

              {/* Description */}
              <div className="max-h-32 overflow-y-auto">
                <span className="text-gray-600">
                  {formData.description || "Not specified"}
                </span>
              </div>
            </div>

            {/* Bottom Section - Duration + Start Date */}
            <div className="flex justify-between items-center mt-4 pt-2">
              <span className="text-black">
                <span>Duration:</span> <span className="font-semibold">{formData.durationDays ? `${formData.durationDays} days` : "Not specified"}</span>
              </span>

              <span className="text-black pr-7">
                <span>Start Date:</span> <span className="font-semibold">{formData.startDate || "Not specified"}</span>
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
        <div className="p-6 mb-6 mt-6">
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
              <span className="text-gray-600">Available now:</span>
              <span className={`font-medium ${
                pricingCalculation.availableDevices < pricingCalculation.numberOfDevices 
                  ? 'text-red-600' 
                  : 'text-green-600'
              }`}>
                {pricingCalculation.availableDevices} device{pricingCalculation.availableDevices === 1 ? '' : 's'}
              </span>
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
            <div className="border-t border-black/40 pt-3">
              <div className="flex justify-between font-semibold">
                <span>Total Price:</span>
                <span className="text-xl text-[#3674B5]">{formatCurrency(pricingCalculation.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : pricingCalculationError ? (
        <div className="p-6 mb-6 mt-6 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Pricing Calculation Error</h3>
              <p className="text-red-800">{pricingCalculationError}</p>
              <div className="mt-4 p-3 bg-red-100 rounded-md">
                <p className="text-sm text-red-700 font-medium mb-1">Current Configuration:</p>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  <li>Vehicle Type: {formData.vehicleType || 'Not selected'}</li>
                  <li>Material Type: {formData.materialType || 'Not selected'}</li>
                  <li>Category: {formData.category || 'Not selected'}</li>
                  <li>Duration: {formData.durationDays} days</li>
                  <li>Ad Length: {formData.adLengthSeconds} seconds</li>
                  <li>Number of Devices: {formData.numberOfDevices}</li>
                </ul>
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
    <div className="relative min-h-screen overflow-hidden">
    {/* Background Image */}
    <div
      className="fixed inset-0 bg-cover bg-center bg-no-repeat blur-sm brightness-90"
      style={{ backgroundImage: "url('/image/bg2.jpg')" }}/>
    <div className="fixed inset-0 bg-white/40 backdrop-blur-xl" />

    {/* Content */}
    <div className="relative z-10 min-h-screen bg-transparent lg:pl-72 px-4 sm:px-5 lg:pr-5 py-6 lg:p-10">
      <button
        onClick={() => navigate('/advertisements')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 pt-12 lg:pt-3"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm sm:text-base">Back to Advertisement</span>
      </button>
      <div>
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Create Advertisement</h2>
          </div>
        </div>
      </div>
      <div>
      <div className="max-w-md mx-auto px-2 sm:px-4 py-4">
        {/* Desktop / larger screens – keep your original layout */}
        <div className="hidden sm:flex items-center justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive   = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive
                      ? "border-[#3674B5] bg-[#3674B5] text-white"
                      : isCompleted
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-black/70 text-black/70"
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
                        ? "text-[#3674B5]"
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
        {/* Mobile – the UI from your image */}
        <div className="flex sm:hidden flex-col items-center space-y-2">
          {/* Circles + connecting line */}
          <div className="flex items-center justify-center">
            {steps.map((step, idx) => {
              const isActive    = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              const isLast      = idx === steps.length - 1;

              return (
                <div key={step.number} className="flex items-center">
                  {/* Circle and Title Container */}
                  <div className="flex flex-col items-center">
                    {/* Circle */}
                    <div
                      className={`relative flex items-center justify-center w-10 h-10 rounded-full text-base font-bold transition-colors ${
                        isActive
                          ? "border border-[#3674B5] text-[#3674B5]"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      {isCompleted ? "✓" : step.number}
                    </div>
                    
                    {/* Title under the circle */}
                    <p
                      className={`mt-1 text-xs font-medium w-16 text-center ${
                        isActive
                          ? "text-[#3674B5]"
                          : isCompleted
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>

                  {/* Connecting line (skip after last) */}
                  {!isLast && (
                    <div
                      className={`w-8 h-0.5 mx-1 ${
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
      </div>
      <div className="max-w-3xl mx-auto px-2 sm:px-4 py-6 sm:py-8">
        <form onSubmit={handleSubmit}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          <div className="flex flex-row justify-between items-center gap-2 mt-8">
            {/* Previous Button - Always visible except maybe on step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed sm:bg-transparent text-black/60 sm:text-gray-600 sm:hover:text-gray-800 sm:hover:bg-transparent transition-all duration-300 sm:flex-none"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="sm:block">Previous</span>
            </button>

            {/* Next / Submit Button */}
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                  const button = e.currentTarget;
                  const rect = button.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  button.style.setProperty('--x', `${x}px`);
                  button.style.setProperty('--y', `${y}px`);
                }}
                className="relative flex items-center justify-center gap-2 px-4 py-3 text-white transition-all duration-300 overflow-hidden group hover:scale-105 shadow-md bg-gradient-to-r from-[#1B5087] to-[#3674B5] sm:bg-gradient-to-r sm:from-[#1B5087] sm:to-[#3674B5] bg-[#3674B5] flex-1 sm:flex-none"
              >
                {/* Shiny Hover Effect - Hidden on mobile */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:block"
                  style={{
                    background:
                      'radial-gradient(circle at var(--x, 20%) var(--y, 80%), rgba(255, 255, 255, 0.15) 0%, transparent 50%)',
                  }}
                />
                <span className="relative z-10">Next</span>
                <ChevronRight className="w-5 h-5 relative z-10" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmissionInProgress}
                onMouseMove={(e: React.MouseEvent<HTMLButtonElement>) => {
                  const button = e.currentTarget;
                  const rect = button.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  button.style.setProperty('--x', `${x}px`);
                  button.style.setProperty('--y', `${y}px`);
                }}
                className="relative px-4 py-3 text-white transition-all duration-300 overflow-hidden group hover:scale-105 shadow-md bg-gradient-to-r from-[#1B5087] to-[#3674B5] sm:bg-gradient-to-r sm:from-[#1B5087] sm:to-[#3674B5] bg-[#3674B5] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex-1 sm:flex-none"
              >
                {/* Shiny Hover Effect - Hidden on mobile */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:opacity-0 hidden sm:block"
                  style={{
                    background:
                      'radial-gradient(circle at var(--x, 20%) var(--y, 80%), rgba(255, 255, 255, 0.15) 0%, transparent 50%)',
                  }}
                />
                <span className="relative z-10">
                  {isUploading ? 'Uploading...' : isSubmissionInProgress ? 'Creating...' : 'Create Advertisement'}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
    </div>
  );
};

export default CreateAdvertisement;