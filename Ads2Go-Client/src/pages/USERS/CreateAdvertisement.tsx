import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import { ChevronLeft, ChevronRight, Upload, Calendar, DollarSign, Play, Settings } from 'lucide-react';
import { CREATE_FLEXIBLE_AD } from '../../graphql/mutations/flexibleAdMutations';
import { 
  GET_FLEXIBLE_FIELD_COMBINATIONS, 
  CALCULATE_FLEXIBLE_PRICING,
  FlexiblePricingCalculation 
} from '../../graphql/queries/flexibleAdQueries';
import { uploadFileToFirebase } from '../../utils/fileUpload';

type VehicleType = 'CAR' | 'MOTORCYCLE';
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
  const [showToast, setShowToast] = useState(false);
  const [isSubmissionInProgress, setIsSubmissionInProgress] = useState(false);
  const [pricingCalculation, setPricingCalculation] = useState<FlexiblePricingCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form data
  const [formData, setFormData] = useState<AdvertisementForm>({
    title: '',
    description: '',
    website: '',
    materialType: '',
    vehicleType: 'CAR',
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
      setShowToast(true);
      setTimeout(() => {
        navigate('/advertisements');
      }, 2000);
    },
    onError: (error) => {
      console.error('Error creating ad:', error);
      setErrors({ title: error.message });
    }
  });

  const fieldCombinations = fieldCombinationsData?.getFlexibleFieldCombinations || [];

  // Auto-calculate pricing when form data changes
  useEffect(() => {
    if (formData.materialType && formData.vehicleType && formData.category) {
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

  // Auto-determine category based on material type
  useEffect(() => {
    if (formData.materialType === 'LCD') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    } else if (formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    }
  }, [formData.materialType]);

  // Ensure category is always set before form submission
  const ensureCategoryIsSet = () => {
    if (formData.materialType && !formData.category) {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
      return false; // Category was missing, need to wait for state update
    }
    return true; // Category is set
  };

  // Get available material types for selected vehicle type
  const getAvailableMaterialTypes = () => {
    const combinations = fieldCombinations.filter((combo: any) => 
      combo.vehicleType === formData.vehicleType && combo.isActive
    );
    return Array.from(new Set(combinations.map((combo: any) => combo.materialType)));
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.materialType) newErrors.materialType = 'Material type is required';
    if (!formData.vehicleType) newErrors.vehicleType = 'Vehicle type is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.mediaFile) newErrors.mediaFile = 'Media file is required';

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Ensure category is set before validation
    if (!ensureCategoryIsSet()) {
      console.log('Category was missing, waiting for state update...');
      setTimeout(() => handleSubmit(e), 100);
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    if (!pricingCalculation) {
      setErrors({ title: 'Please wait for pricing calculation to complete' });
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
        category: formData.category || 'DIGITAL', // Fallback to DIGITAL if somehow still missing
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
      setErrors({ title: 'Failed to create advertisement. Please try again.' });
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

  const renderStep1 = () => (
    <div>
      <h2 className="text-2xl font-semibold mb-6 text-center">Choose Your Configuration</h2>
      
      {fieldCombinationsLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading configurations...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Vehicle Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Vehicle Type *</label>
            <div className="grid grid-cols-2 gap-4">
              {['CAR', 'MOTORCYCLE'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleInputChange('vehicleType', type as VehicleType)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.vehicleType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {type === 'CAR' ? '🚗' : '🏍️'}
                    </div>
                    <div className="font-medium">{type}</div>
                  </div>
                </button>
              ))}
            </div>
            {errors.vehicleType && (
              <p className="text-sm text-red-600 mt-1">{errors.vehicleType}</p>
            )}
          </div>

          {/* Material Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Material Type *</label>
            <div className="grid grid-cols-2 gap-4">
              {getAvailableMaterialTypes().map((type) => (
                <button
                  key={type as string}
                  type="button"
                  onClick={() => handleInputChange('materialType', type as string)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.materialType === type
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {type === 'LCD' ? '📺' : '👑'}
                    </div>
                    <div className="font-medium">{type as string}</div>
                  </div>
                </button>
              ))}
            </div>
            {errors.materialType && (
              <p className="text-sm text-red-600 mt-1">{errors.materialType}</p>
            )}
          </div>

          {/* Configuration Summary */}
          {formData.materialType && formData.vehicleType && (
            <div className="bg-blue-50 rounded-xl p-4">
              <h3 className="font-medium text-blue-900 mb-2">Selected Configuration</h3>
              <div className="text-sm text-blue-700">
                <p><strong>Vehicle:</strong> {formData.vehicleType}</p>
                <p><strong>Material:</strong> {formData.materialType}</p>
                <p><strong>Category:</strong> {formData.category}</p>
                <p><strong>Available Devices:</strong> {pricingCalculation?.availableDevices || (isCalculating ? '⏳ Calculating...' : '⏳ Loading...')}</p>
                <p><strong>Ad Length Options:</strong> 20s, 40s, or 60s</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Advertisement Details</h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Advertisement Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            placeholder="Enter advertisement title"
            required
          />
          {errors.title && (
            <p className="text-sm text-red-600 mt-1">{errors.title}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400 h-32"
            placeholder="Describe your advertisement"
            required
          />
          {errors.description && (
            <p className="text-sm text-red-600 mt-1">{errors.description}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Website URL (Optional)
          </label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => handleInputChange('website', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Media File *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => handleInputChange('mediaFile', e.target.files?.[0] || null)}
              className="hidden"
              id="media-upload"
              required
            />
            <label htmlFor="media-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Click to upload media file</p>
              <p className="text-sm text-gray-500">Supports images and videos</p>
            </label>
            {formData.mediaFile && (
              <p className="text-sm text-green-600 mt-2">
                Selected: {formData.mediaFile.name}
              </p>
            )}
          </div>
          {errors.mediaFile && (
            <p className="text-sm text-red-600 mt-1">{errors.mediaFile}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Campaign Settings</h2>
      <div className="space-y-6">
        {/* Duration */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Campaign Duration *
          </label>
          <select
            value={formData.durationDays}
            onChange={(e) => handleInputChange('durationDays', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            required
          >
            <option value="">Select duration</option>
            <option value={30}>1 month (30 days)</option>
            <option value={60}>2 months (60 days)</option>
            <option value={90}>3 months (90 days)</option>
            <option value={120}>4 months (120 days)</option>
            <option value={150}>5 months (150 days)</option>
            <option value={180}>6 months (180 days)</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Choose from 1 to 6 months duration
          </p>
        </div>

        {/* Ad Length */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Ad Length (Seconds) *
          </label>
          <select
            value={formData.adLengthSeconds}
            onChange={(e) => handleInputChange('adLengthSeconds', parseInt(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            required
          >
            <option value="">Select ad length</option>
            <option value={20}>20 seconds</option>
            <option value={40}>40 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Choose from: 20, 40, or 60 seconds
          </p>
          {errors.adLengthSeconds && (
            <p className="text-sm text-red-600 mt-1">{errors.adLengthSeconds}</p>
          )}
        </div>

        {/* Number of Devices */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Number of Devices *
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
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum: {getMaxDevices()} devices
          </p>
          {errors.numberOfDevices && (
            <p className="text-sm text-red-600 mt-1">{errors.numberOfDevices}</p>
          )}
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Campaign Start Date *
          </label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => handleInputChange('startDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            required
          />
          {errors.startDate && (
            <p className="text-sm text-red-600 mt-1">{errors.startDate}</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Pricing & Summary</h2>
      
      {/* Pricing Calculation */}
      {isCalculating ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calculating pricing...</p>
        </div>
      ) : pricingCalculation ? (
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Breakdown</h3>
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
              <span className="font-medium">{pricingCalculation.adLengthSeconds} seconds (20/40/60s only)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Devices:</span>
              <span className="font-medium">{pricingCalculation.numberOfDevices}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Plays per day per device:</span>
              <span className="font-medium">{pricingCalculation.playsPerDayPerDevice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total plays per day:</span>
              <span className="font-medium">{pricingCalculation.totalPlaysPerDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Price per play:</span>
              <span className="font-medium">{formatCurrency(pricingCalculation.pricePerPlay)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Daily revenue:</span>
              <span className="font-medium">{formatCurrency(pricingCalculation.dailyRevenue)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Price:</span>
                <span className="text-blue-600">{formatCurrency(pricingCalculation.totalPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Please complete the previous steps to see pricing</p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Title:</span>
            <span className="font-medium">{formData.title || 'Not specified'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Configuration:</span>
            <span className="font-medium">{formData.materialType} {formData.vehicleType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration:</span>
            <span className="font-medium">{formData.durationDays} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Start Date:</span>
            <span className="font-medium">{formData.startDate || 'Not specified'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Media File:</span>
            <span className="font-medium">{formData.mediaFile?.name || 'Not selected'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const steps = [
    { number: 1, title: 'Configuration', icon: Settings },
    { number: 2, title: 'Details', icon: Play },
    { number: 3, title: 'Settings', icon: Calendar },
    { number: 4, title: 'Pricing', icon: DollarSign }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Advertisement</h1>
              <p className="text-gray-600 mt-1">Flexible configuration and pricing</p>
            </div>
            <button
              onClick={() => navigate('/advertisements')}
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isActive 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : isCompleted 
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 bg-white text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <span className="text-sm font-bold">✓</span>
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit}>
          {/* Step Content */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          {/* Navigation Buttons */}
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

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.min(4, prev + 1))}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : isSubmissionInProgress ? 'Creating...' : 'Create Advertisement'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          Advertisement created successfully! Redirecting...
        </div>
      )}
    </div>
  );
};

export default CreateAdvertisement;
