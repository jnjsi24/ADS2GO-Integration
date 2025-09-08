import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronRight, Upload, Play, Pause, Loader2, Calendar } from 'lucide-react';
import { storage } from '../../firebase/init';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GET_ALL_ADS_PLANS } from '../../graphql/admin';
import { GET_MATERIALS_BY_CATEGORY_AND_VEHICLE } from '../../graphql/admin';
import { CREATE_AD } from '../../graphql/admin';

type MaterialCategory = 'DIGITAL' | 'NON-DIGITAL';
type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';

type AdsPlan = {
  _id: string;
  name: string;
  description: string;
  durationDays: number;
  totalPrice: number;
  materialType: string;
  vehicleType: VehicleType;
  numberOfDevices: number;
  adLengthSeconds: number;
  category: MaterialCategory;
  status: string;
};

type AdvertisementForm = {
  title: string;
  description: string;
  adType?: 'DIGITAL' | 'NON_DIGITAL';
  planId: string;
  materialId: string;
  mediaFile?: File;
  mediaPreview?: string;
  startDate: string; // Changed from startTime to startDate for better UX
};

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<AdsPlan | null>(null);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [showToast, setShowToast] = useState(false);

  // State for custom calendar
  const [currentDate, setCurrentDate] = useState(new Date()); // Initialize with today's date (September 5, 2025)
  const [selectedDate, setSelectedDate] = useState(new Date()); // Initialize with today's date

// Function to generate days for the current month
const getDaysInMonth = (date: Date) => {
  
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysArray = [];
  for (let i = 0; i < firstDay; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= days; i++) {
    daysArray.push(i);
  }
  return daysArray;
};

// Handle date selection
const today = new Date(); // Current date

// Handle date selection
const handleDateClick = (day: number | null) => {
  if (day) {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);

    // Prevent selecting past dates
    if (newDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      return;
    }

    setSelectedDate(newDate);
    setFormData({ ...formData, startDate: newDate.toISOString().split('T')[0] });
  }
};


// Navigate to previous month
const prevMonth = () => {
  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
};

// Navigate to next month
const nextMonth = () => {
  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
};

  const [formData, setFormData] = useState<AdvertisementForm>({
    title: '',
    description: '',
    planId: '',
    materialId: '',
    startDate: new Date().toISOString().split('T')[0], // Default to today's date
  });
  const [materials, setMaterials] = useState<any[]>([]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Function to calculate end date based on start date and duration
  const calculateEndDate = (startDate: string, durationDays: number): string => {
    const start = new Date(startDate);
    const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return end.toISOString().split('T')[0];
  };

  // Function to format date for display
  const formatDateForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  


  // Automatically fetch and select material based on selected plan
  const { loading: loadingMaterials } = useQuery(GET_MATERIALS_BY_CATEGORY_AND_VEHICLE, {
    variables: { 
      category: selectedPlan?.category as any,
      vehicleType: selectedPlan?.vehicleType as any
    },
    skip: !selectedPlan,
    onCompleted: (data) => {
      if (data?.getMaterialsByCategoryAndVehicle?.length > 0) {
        setMaterials(data.getMaterialsByCategoryAndVehicle);
    
        // Try to find a material that matches the plan's materialType
        const matchingMaterial = data.getMaterialsByCategoryAndVehicle.find(
          (m: any) => m.materialType === selectedPlan?.materialType
        );
    
        if (matchingMaterial) {
          setFormData(prev => ({ ...prev, materialId: matchingMaterial.id }));
        } else {
          // fallback: pick first material if exact match not found
          setFormData(prev => ({ ...prev, materialId: data.getMaterialsByCategoryAndVehicle[0]?.id || '' }));
        }
      } else {
        setMaterials([]);
        setFormData(prev => ({ ...prev, materialId: '' }));
      }
    },
    onError: (error) => {
      console.error('Error fetching materials:', error);
      setMaterials([]);
      setFormData(prev => ({ ...prev, materialId: '' }));
    }
  });

  // Fetch ads plans
  const { data, loading, error } = useQuery(GET_ALL_ADS_PLANS, {
    onCompleted: (data) => {
      console.log('Fetched plans:', data);
    },
    onError: (error) => {
      console.error('Error fetching plans:', error);
    }
  });

  const [createAd, { loading: isSubmitting }] = useMutation(CREATE_AD, {
    onCompleted: () => {
      navigate('/advertisements');
    },
    onError: (error) => {
      console.error('Error creating ad:', error);
    }
  });

  // Transform the data to match the expected AdsPlan type
  const plans: AdsPlan[] = React.useMemo(() => {
    if (!data?.getAllAdsPlans) return [];
    
    console.log('Raw plans data:', data.getAllAdsPlans);
    
    return data.getAllAdsPlans
      .filter((plan: any) => {
        const isRunning = plan.status === 'RUNNING';
        console.log(`Plan ${plan.id} (${plan.name}):`, { 
          status: plan.status, 
          isRunning,
          hasMaterialType: !!plan.materialType,
          hasVehicleType: !!plan.vehicleType
        });
        return isRunning;
      })
      .map((plan: any) => ({
        _id: plan.id,
        name: plan.name,
        description: plan.description,
        durationDays: plan.durationDays || 30,
        totalPrice: plan.totalPrice || 0,
        materialType: plan.materialType,
        vehicleType: plan.vehicleType,
        numberOfDevices: plan.numberOfDevices || 1,
        adLengthSeconds: plan.adLengthSeconds || 30,
        category: plan.category || 'STANDARD',
        status: plan.status || 'ACTIVE'
      }));
  }, [data]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setFormData({
        ...formData,
        mediaFile: file,
        mediaPreview: previewUrl
      });
    }
  };

  // Firebase Storage upload function
  const uploadFileToFirebase = async (file: File): Promise<string> => {
    try {
      setUploadProgress(0);
      
      // Generate unique filename with timestamp
      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop() || '';
      const fileName = `advertisements/${timestamp}_${file.name}`;
      
      // Create Firebase Storage reference
      const storageRef = ref(storage, fileName);
      
      console.log('Uploading file to Firebase:', fileName, 'Size:', file.size, 'bytes');
      
      // Upload file to Firebase Storage
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('File uploaded successfully. Download URL:', downloadURL);
      setUploadProgress(100);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file to Firebase:', error);
      throw new Error('Failed to upload media file to Firebase Storage');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlan) {
      alert('Please select a plan first');
      return;
    }

    if (!formData.materialId) {
      alert('No suitable material found for the selected plan');
      return;
    }

    if (!formData.mediaFile) {
      alert('Please upload a media file');
      return;
    }

    if (!formData.startDate) {
      alert('Please select a start date');
      return;
    }

    try {
      // Upload media file to Firebase Storage
      const mediaFileURL = await uploadFileToFirebase(formData.mediaFile);

      // Determine ad format based on file type
      const fileExtension = formData.mediaFile?.name.split('.').pop()?.toLowerCase() || '';
      const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileExtension);
      
      // Calculate start and end times
      const startTime = new Date(formData.startDate).toISOString();
      const endTime = new Date(
        new Date(formData.startDate).getTime() + selectedPlan.durationDays * 24 * 60 * 60 * 1000
      ).toISOString();
      
      // Prepare the input for createAd mutation
      const input = {
        title: formData.title,
        description: formData.description,
        materialId: formData.materialId,
        planId: selectedPlan._id,
        adType: selectedPlan.category === 'DIGITAL' ? 'DIGITAL' : 'NON_DIGITAL',
        adFormat: isVideo ? 'VIDEO' : 'IMAGE',
        price: selectedPlan.totalPrice,
        status: 'PENDING',
        startTime: startTime,
        endTime: endTime,
        mediaFile: mediaFileURL // Use Firebase download URL instead of local path
      };

      // Create the ad with the Firebase media URL
       await createAd({
    variables: { input },
  });

  // Show toast instead of alert
  setShowToast(true);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    setShowToast(false);
    navigate('/advertisements'); // navigate after toast disappears
  }, 3000);

} catch (error) {
  console.error('Error creating advertisement:', error);
  alert('Failed to create advertisement. Please try again.');
}
  };

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2:
        return selectedPlan !== null && formData.materialId !== '';
      case 3:
        return formData.title && formData.description && formData.startDate;
      case 4:
        return formData.mediaFile;
      default:
        return true;
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {['Select Plan', 'Ad Details', 'Upload Media', 'Review'].map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                currentStep > index + 1 || (currentStep === index + 1 && canProceedToStep(currentStep))
                  ? 'bg-[#FF9800] text-white font-bold'
                  : 'bg-gray-200 text-gray-600 '
              }`}
            >
              {index + 1}
            </div>
            <span className={`text-sm mt-1 text-gray-600 ${currentStep === index + 1 ? 'font-bold' : ''}`}>{step}</span>
          </div>
          {index < 3 && (
            <div className="w-16 h-1 bg-gray-200 mx-2 mb-5">
              <div
                className={`h-full ${
                  currentStep > index + 1 ? 'bg-[#FF9B45]' : 'bg-gray-200'
                }`}
                style={{
                  width: currentStep > index + 1 ? '100%' : '0%',
                  transition: 'width 0.3s ease-in-out',
                }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // Inside your CreateAdvertisement component, before return (...)
useEffect(() => {
  if (plans.length > 0) {
    const activePlan = plans[activePlanIndex];
    setSelectedPlan(activePlan);
    setFormData((prev) => ({
      ...prev,
      planId: activePlan._id,
      adType: activePlan.category === "DIGITAL" ? "DIGITAL" : "NON_DIGITAL",
    }));
  }
}, [activePlanIndex, plans]);

  const renderStep1 = () => (
  <div>
    <h2 className="text-2xl font-semibold mb-6 text-center">Choose Your Plan</h2>

    {loading ? (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#251f70]" />
        <span className="ml-2">Loading plans...</span>
      </div>
    ) : error ? (
      <div className="text-center py-8 text-red-500">
        Error loading plans. Please try again later.
      </div>
    ) : plans.length === 0 ? (
      <div className="text-center py-8 text-gray-500">
        No active plans available at the moment.
      </div>
    ) : (
      <div className="relative h-[550px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {plans.map((plan, index) => {
            let transformClass = "scale-90 opacity-0";
            if (index === activePlanIndex) {
              transformClass = "scale-105 opacity-100 z-20"; // front card slightly bigger
            } else if (index === (activePlanIndex + 1) % plans.length) {
              transformClass = "translate-x-[40%] scale-100 opacity-60 z-10"; // right
            } else if (index === (activePlanIndex - 1 + plans.length) % plans.length) {
              transformClass = "translate-x-[-40%] scale-100 opacity-60 z-10"; // left
            }

            return (
              <div
                key={plan._id}
                className={`absolute mb-8 w-full max-w-md h-[480px] transform transition-all duration-500 ${transformClass}`}
                onClick={() => setActivePlanIndex(index)} // 🆕 click side card to bring it front
              >
                <div
                  className={`border-2 rounded-lg p-6 cursor-pointer shadow-md h-full flex flex-col justify-between transition-all ${
                    selectedPlan?._id === plan._id
                      ? "shadow-xl bg-white border-gray-400"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <h3 className="text-xl mt-4 font-semibold mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-4">{plan.description}</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span className="font-medium">{plan.durationDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vehicles:</span>
                      <span className="font-medium">{plan.vehicleType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Material:</span>
                      <span className="font-medium">{plan.materialType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Devices:</span>
                      <span className="font-medium">{plan.numberOfDevices}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ad Length:</span>
                      <span className="font-medium">{plan.adLengthSeconds}s</span>
                    </div>
                    <div className="border-t pt-2 mt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total Price:</span>
                        <span className="text-[#251f70]">
                          ₱{plan.totalPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation buttons */}
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center text-gray-500 hover:bg-white shadow-md transition-all hover:scale-110"
          onClick={() =>
            setActivePlanIndex((prev) => (prev - 1 + plans.length) % plans.length)
          }
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center text-gray-500 hover:bg-white shadow-md transition-all hover:scale-110"
          onClick={() => setActivePlanIndex((prev) => (prev + 1) % plans.length)}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-center items-center space-x-3">
          {plans.map((_, idx) => (
            <button
              key={idx}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                activePlanIndex === idx ? "bg-[#251f70] w-5" : "bg-gray-300"
              }`}
              onClick={() => setActivePlanIndex(idx)}
            />
          ))}
        </div>
      </div>
    )}

    {/* Auto-material selection section (unchanged, but always matches selectedPlan) */}
    {selectedPlan && (
      <div className="mt-8 p-4 bg-blue-50 max-w-2xl mx-auto rounded-lg">
        <h3 className="font-medium text-[#1B5087] mb-2">Automatic Material Selection</h3>
        {loadingMaterials ? (
          <div className="flex items-center text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Finding compatible materials...
          </div>
        ) : formData.materialId ? (
          <div className="text-[#1B5087]">
            <p className="text-sm">
              ✓ Compatible material automatically selected for your {selectedPlan.category} plan
              on {selectedPlan.vehicleType} vehicles.
            </p>
            {materials.length > 0 && (
              <p className="text-sm mt-1">
                Material ID: {materials.find((m) => m.id === formData.materialId)?.materialId}
              </p>
            )}
          </div>
        ) : (
          <div className="text-red-700">
            <p className="text-sm">
              ⚠ No compatible materials found for this plan. Please contact support.
            </p>
          </div>
        )}
      </div>
    )}
  </div>
);


  // Step 2: Advertisement Details (previously step 3)
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
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400"
            placeholder="Enter advertisement title"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400 h-32"

            placeholder="Describe your advertisement"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Campaign Start Date *
          </label>
          <div className="relative">
            <div className="bg-white border border-gray-300 rounded-md shadow-sm p-14">
              <div className="flex justify-between items-center mb-3">
                <button onClick={prevMonth} className="text-black pl-6 mb-7 hover:text-[#FF9B45]">
                  <ChevronLeft size={20} />
                </button>
                <select
                  value={currentDate.getMonth()}
                  onChange={(e) => {
                    const newMonth = parseInt(e.target.value);
                    const newDate = new Date(currentDate.getFullYear(), newMonth, 1);

                    // Prevent selecting past month in the current year
                    if (currentDate.getFullYear() === today.getFullYear() && newMonth < today.getMonth()) {
                      return;
                    }
                    setCurrentDate(newDate);
                  }}
                  className="text-[#1B5087] text-lg font-bold mb-7 bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((month, index) => {
                    const isDisabled = currentDate.getFullYear() === today.getFullYear() && index < today.getMonth();
                    return (
                      <option key={month} value={index} disabled={isDisabled}>
                        {month}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={currentDate.getFullYear()}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    if (newYear < today.getFullYear()) return; // prevent past years
                    setCurrentDate(new Date(newYear, currentDate.getMonth(), 1));
                  }}
                  className="text-[#1B5087] text-lg font-bold mb-7 bg-transparent border-none focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 5 + i).map(year => (
                    <option key={year} value={year} disabled={year < today.getFullYear()}>
                      {year}
                    </option>
                  ))}
                </select>

                <button onClick={nextMonth} className="text-black mb-7 pr-8 hover:text-[#FF9B45]">
                  <ChevronRight size={20} />
                </button>
              </div>
              {/* This container holds the days of the week and the horizontal line */}
              <div className="grid grid-cols-7 gap-1 text-center text-gray-700 border-b-2 pb-4 border-gray-300 pb-2">
                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                  <div key={day} className="font-semibold text-sm">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-gray-700 pt-2">
  {getDaysInMonth(currentDate).map((day, index) => {
    const dayDate = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
    const isPast = dayDate ? dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;

    return (
      <div
        key={index}
        onClick={() => !isPast && handleDateClick(day)}
        className={`cursor-pointer p-2 rounded-lg ${
          day
            ? isPast
              ? 'text-gray-300 cursor-not-allowed'
              : selectedDate.getDate() === day &&
                selectedDate.getMonth() === currentDate.getMonth() &&
                selectedDate.getFullYear() === currentDate.getFullYear()
              ? 'bg-[#1B5087] text-white'
              : 'text-gray-800 hover:bg-gray-200 hover:text-black'
            : 'text-gray-300'
        }`}
      >
        {day || ''}
      </div>
    );
  })}
</div>

            </div>
          </div>
          {selectedPlan && formData.startDate && (
            <p className="text-sm text-gray-600 mt-2">
              Campaign will end on: <span className="font-bold">
                {formatDateForDisplay(calculateEndDate(formData.startDate, selectedPlan.durationDays))}
              </span>
            </p>
          )}
        </div>

        {selectedPlan && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Selected Plan: {selectedPlan.name}</h3>
            <p className="text-sm text-gray-600">
              Duration: {selectedPlan.durationDays} days | 
              Price: ₱{selectedPlan.totalPrice.toLocaleString()} | 
              Ad Length: {selectedPlan.adLengthSeconds} seconds
            </p>
            {materials.length > 0 && formData.materialId && (
              <p className="text-sm text-gray-600 mt-2">
                Material: {materials.find(m => m.id === formData.materialId)?.materialType} 
                (ID: {materials.find(m => m.id === formData.materialId)?.materialId})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
  // Step 3: Upload Media (previously step 4)
  const renderStep3 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Upload Media</h2>
      <div className="space-y-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept="image/*,video/mp4"
            onChange={handleFileUpload}
            className="hidden"
            id="media-upload"
          />
          <label
            htmlFor="media-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700">
              Click to upload media file
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Supports: JPG, PNG, MP4 (Max file size: 50MB)
            </p>
          </label>
        </div>

        {/* Upload Progress Indicator */}
        {uploadProgress !== null && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Uploading to Firebase...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#251f70] h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {formData.mediaPreview && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Preview:</h3>
            <div className="border rounded-lg overflow-hidden">
              {formData.mediaFile?.type.startsWith('video/') ? (
                <div className="relative">
                  <video
                    src={formData.mediaPreview}
                    className="w-full h-64 object-cover"
                    controls={false}
                    muted
                    ref={(video) => {
                      if (video) {
                        if (isVideoPlaying) {
                          video.play();
                        } else {
                          video.pause();
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 text-white"
                  >
                    {isVideoPlaying ? (
                      <Pause className="w-12 h-12" />
                    ) : (
                      <Play className="w-12 h-12" />
                    )}
                  </button>
                </div>
              ) : (
                <img
                  src={formData.mediaPreview}
                  alt="Preview"
                  className="w-full h-64 object-cover"
                />
              )}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              File: {formData.mediaFile?.name} ({Math.round((formData.mediaFile?.size || 0) / 1024 / 1024 * 100) / 100} MB)
            </div>
          </div>
        )}

        {selectedPlan && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Your media should be exactly {selectedPlan.adLengthSeconds} seconds long 
              for optimal display on {selectedPlan.materialType} devices.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Step 4: Review & Submit (previously step 5)
  const renderStep4 = () => (
  <div className="max-w-4xl mx-auto">
    <h2 className="text-xl text-center font-medium mb-4 text-gray-800">Review & Submit</h2>

    {/* Top Row: Media Preview + Title/Description/Duration */}
    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-4">

      {/* Media Preview */}
      <div className="bg-white rounded-lg shadow-sm p-4 border-2 border-gray-300">
        <h3 className="text-xl font-medium text-gray-600 mb-7">Media Preview</h3>
        {formData.mediaPreview && (
          <div className="mb-1">
            <div className="border border-gray-200 rounded-md overflow-hidden mt-1">
              {formData.mediaFile?.type.startsWith('video/') ? (
                <video
                  src={formData.mediaPreview}
                  className="w-full h-60 object-cover"
                  controls
                />
              ) : (
                <img
                  src={formData.mediaPreview}
                  alt="Media preview"
                  className="w-full h-32 object-cover"
                />
              )}
            </div>
            <p className="text-md text-center mt-2 text-black">
              File: {formData.mediaFile?.name}
            </p>
          </div>
        )}
      </div>

      {/* Title/Description/Duration */}
      <div className="bg-white rounded-lg shadow-sm p-4 border-2 border-gray-300">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-600">Advertisement Information</h3>
          <div className="w-full border-b-2 border-gray-300 mt-2"></div>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">Title:</span>
            <p className="text-lg text-gray-600">{formData.title}</p>
          </div>
          <div>
            <span className="font-medium">Description:</span>
            <p className="text-lg text-gray-600">{formData.description}</p>
          </div>
          <div>
            <span className="font-medium">Campaign Duration:</span>
            <p className="text-lg text-gray-600">{selectedPlan?.durationDays} days</p>
          </div>
        </div>

        {/* Agreement / Notice */}
    <div className="bg-blue-50 rounded-lg p-4 mt-10 text-sm text-blue-800">
      <p>
        By creating this advertisement, you agree to pay ₱{selectedPlan?.totalPrice.toLocaleString() }
        for a {selectedPlan?.durationDays}-day campaign starting on {formatDateForDisplay(formData.startDate)}.
        Your advertisement will be submitted for review and you'll be notified once it's approved.
      </p>
    </div>

      </div>
    </div>

    {/* Second Row: Campaign Schedule + Selected Plan & Material */}
    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-4">

      {/* Campaign Schedule */}
      <div className="bg-white rounded-lg shadow-sm p-4 border-2 border-gray-300">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-600">Campaign Schedule</h3>
          <div className="w-full border-b-2 border-gray-300 mt-2"></div>
        </div>
        <div className="space-y-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">Start Date:</span>
            <p className="text-lg text-gray-600">{formatDateForDisplay(formData.startDate)}</p>
          </div>
          <div>
            <span className="font-medium">End Date:</span>
           <p className="text-lg text-gray-600">
              {selectedPlan ? formatDateForDisplay(calculateEndDate(formData.startDate, selectedPlan.durationDays)) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Selected Plan & Material */}
      <div className="bg-white rounded-lg shadow-sm p-4 border-2 border-gray-300">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-600">Selected Plan & Material</h3>
          <div className="w-full border-b-2 border-gray-300 mt-2"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Plan:</span>
            <p className="text-blue-600">{selectedPlan?.name}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Duration:</span>
           <p className="text-lg text-gray-600">{selectedPlan?.durationDays} days</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Vehicle Type:</span>
           <p className="text-lg text-gray-600">{selectedPlan?.vehicleType}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Material:</span>
           <p className="text-lg text-gray-600">{selectedPlan?.materialType}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Devices:</span>
           <p className="text-lg text-gray-600">{selectedPlan?.numberOfDevices}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">Total Price:</span>
            <p className="text-blue-600 text-lg font-medium">P{selectedPlan?.totalPrice.toLocaleString()}</p>
          </div>
          {materials.length > 0 && formData.materialId && (
            <div className="col-span-2">
              <span className="font-medium text-gray-700">Auto-selected Material:</span>
             <p className="text-lg text-gray-600">
                {materials.find(m => m.id === formData.materialId)?.materialType}
                (ID: {materials.find(m => m.id === formData.materialId)?.materialId})
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

    
  </div>
);

  
  return (
    <div className="min-h-screen bg-white pl-64 pr-5 p-10">
      <div className="bg-white ">
        <div className="flex items-center mb-6 pl-9">
          <button
            onClick={() => navigate('/advertisements')}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back to Advertisements
          </button>
        </div>
        
        <div className="max-w-5xl mx-auto bg-white">
          {renderStepIndicator()}
          
          <div className="mb-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </div>
          
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className={`px-4 py-2 rounded-md ml-44 w-60${
                currentStep === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Previous
            </button>
            
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceedToStep(currentStep + 1)}
                className={`px-4 py-2 rounded-md mr-44 w-60 ${
                  !canProceedToStep(currentStep + 1) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#FF9800] text-white hover:bg-[#FF9B45]'
                }`}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceedToStep(currentStep) || isSubmitting}
                className={`px-4 py-2 rounded-md mr-44 w-60 ${
                  !canProceedToStep(currentStep) || isSubmitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#FF9800] text-white hover:bg-[#FF9B45]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Advertisement'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        className={`fixed bottom-5 right-5 bg-[#251f70] text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-500 ${
          showToast ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0'
        }`}
      >
        Advertisement created successfully!
      </div>
    </div>
  );
};

export default CreateAdvertisement;