import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronDown, Car, TabletSmartphone, Hourglass, QrCode, FileType, View, ChevronRight, Upload, Play, CalendarCheck2, CalendarX2, Pause, Loader2 } from 'lucide-react';
import { storage } from '../../firebase/init';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GET_ALL_ADS_PLANS } from '../../graphql/admin';
import { GET_MATERIALS_BY_CATEGORY_AND_VEHICLE } from '../../graphql/admin';
import { CREATE_AD } from '../../graphql/admin';
import { motion, AnimatePresence } from "framer-motion";


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
  
  // Move these here from renderStep2
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  // State for custom calendar
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

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
                  ? 'bg-[#feb011] text-white border border-[#feb011] font-bold'
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
                  currentStep > index + 1 ? 'bg-gray-300' : 'bg-gray-200'
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
      <div className="relative h-[560px] flex items-center justify-center overflow-hidden">
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
                className={`absolute mb-8 w-full max-w-md h-[490px] transform transition-all duration-500 ${transformClass}`}
                onClick={() => setActivePlanIndex(index)}
              >
                <div
                  className={`border rounded-lg p-6 cursor-pointer shadow-md h-full flex flex-col justify-between transition-all ${
                    selectedPlan?._id === plan._id
                      ? 'shadow-xl bg-white border-gray-400'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <h3 className="text-xl text-[#1B4F9C] font-bold">
                    {plan.name}
                  </h3>
                  <p className="text-sm">{plan.description}</p>

                  {/* Total Price */}
                    <div className="text-3xl mt-5 font-bold items-center">
                      <span className="text-[#1B4F9C]">
                        ₱{plan.totalPrice.toLocaleString()}
                      </span>
                    </div>
                    <p className='text-sm'>on this advertisement</p>


                    <p className="text-sm text-gray-500 mt-7"> What's in the plan:</p>
                  <div className="space-y-4 mt-2 text-sm">
                    {/* Duration */}
                    <div className="flex items-center space-x-2">
                      <Hourglass className="text-black" size={20} />
                      <span className="font-medium ml-auto">
                        {plan.durationDays} Days Advertisement
                      </span>
                    </div>

                    {/* Vehicles */}
                    <div className="flex items-center space-x-2">
                      <Car className="text-black" size={20} />
                      <span className="font-medium ml-auto">
                        {plan.vehicleType} Usage
                      </span>
                    </div>

                    {/* Material */}
                    <div className="flex items-center space-x-2">
                      <QrCode className="text-black" size={20} />
                      <span className="font-medium ml-auto">
                        {plan.materialType}
                      </span>
                    </div>

                    {/* Devices */}
                    <div className="flex items-center space-x-2">
                      <TabletSmartphone className="text-black" size={20} />
                      <span className="font-medium ml-auto">
                        {plan.numberOfDevices} Devices
                      </span>
                    </div>

                    {/* Ad Length */}
                    <div className="flex items-center space-x-2">
                      <View className="text-black" size={20} />
                      <span className="font-medium ml-auto">
                        {plan.adLengthSeconds} Seconds
                      </span>
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
  const renderStep2 = (
  showMonthDropdown: boolean,
  setShowMonthDropdown: React.Dispatch<React.SetStateAction<boolean>>,
  showYearDropdown: boolean,
  setShowYearDropdown: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = Array.from({ length: 5 }, (_, i) => 2025 + i);

  const handleMonthChange = (index: number) => {
    if (currentDate.getFullYear() === today.getFullYear() && index < today.getMonth()) return;
    setCurrentDate(new Date(currentDate.getFullYear(), index, 1));
    setShowMonthDropdown(false);
  };

  const handleYearChange = (year: number) => {
    if (year < today.getFullYear()) return;
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setShowYearDropdown(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Advertisement Details</h2>
      <div className="space-y-6">
        {/* Advertisement Title */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Advertisement Title 
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

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Description 
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-0 focus:border-gray-400 h-32"
            placeholder="Describe your advertisement"
            required
          />
        </div>

        {/* Calendar */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Campaign Start Date 
          </label>
          <div className="relative">
            <div className="bg-white rounded-md p-14">
              <div className="flex justify-center items-center mb-3">
                {/* Month Dropdown */}
                <div className="relative w-32 text-center mb-7">
                  <button
                    onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                    className="flex items-center justify-center gap-2 w-full text-[#1B5087] text-lg font-bold bg-transparent focus:outline-none"
                  >
                    {months[currentDate.getMonth()]}
                    <ChevronDown
                      size={18}
                      className={`transform transition-transform duration-200 ${
                        showMonthDropdown ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {showMonthDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                      >
                        {months.map((m, idx) => {
                          const isDisabled =
                            currentDate.getFullYear() === today.getFullYear() &&
                            idx < today.getMonth();
                          return (
                            <button
                              key={m}
                              disabled={isDisabled}
                              onClick={() => handleMonthChange(idx)}
                              className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                                isDisabled
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Year Dropdown */}
                <div className="relative w-24 text-center mb-7">
                  <button
                    onClick={() => setShowYearDropdown(!showYearDropdown)}
                    className="flex items-center justify-center gap-2 w-full text-[#1B5087] text-lg font-bold bg-transparent focus:outline-none"
                  >
                    {currentDate.getFullYear()}
                    <ChevronDown
                      size={18}
                      className={`transform transition-transform duration-200 ${
                        showYearDropdown ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {showYearDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                      >
                        {years.map((year) => (
                          <button
                            key={year}
                            disabled={year < today.getFullYear()}
                            onClick={() => handleYearChange(year)}
                            className={`block w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                              year < today.getFullYear()
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {year}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-gray-700 border-b-2 pb-4 border-gray-300">
                {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map(day => (
                  <div key={day} className="font-semibold text-sm">{day}</div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 text-center text-gray-700 pt-2">
                {getDaysInMonth(currentDate).map((day, index) => {
                  const dayDate = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
                  const isPast = dayDate
                    ? dayDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                    : false;
                  return (
                    <div
                      key={index}
                      onClick={() => !isPast && handleDateClick(day)}
                      className={`cursor-pointer p-2 rounded-lg ${
                        day
                          ? isPast
                            ? "text-gray-300 cursor-not-allowed"
                            : selectedDate.getDate() === day &&
                              selectedDate.getMonth() === currentDate.getMonth() &&
                              selectedDate.getFullYear() === currentDate.getFullYear()
                            ? "bg-[#1B5087] text-white"
                            : "text-gray-800 hover:bg-gray-200 hover:text-black"
                          : "text-gray-300"
                      }`}
                    >
                      {day || ""}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedPlan && formData.startDate && (
            <p className="text-sm text-gray-600 mt-2">
              Campaign will end on:{" "}
              <span className="font-bold">
                {formatDateForDisplay(
                  calculateEndDate(formData.startDate, selectedPlan.durationDays)
                )}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

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

      {/* === Single grid row with Media + Info === */}
      <div className="grid grid-cols-1 md:grid-cols-[1.8fr_2fr] gap-4 mb-4">
        
        {/* LEFT COLUMN : Media + Campaign Schedule BELOW */}
        <div className="bg-white p-4">
          {formData.mediaPreview && (
            <div className="mb-1">
              <div className="border border-gray-200 rounded-md overflow-hidden mt-1">
                {formData.mediaFile?.type.startsWith("video/") ? (
                  <video src={formData.mediaPreview} className="w-full h-60 object-cover" controls />
                ) : (
                  <img
                    src={formData.mediaPreview}
                    alt="Media preview"
                    className="w-full h-52 object-cover"
                  />
                )}
              </div>
              <p className="text-md text-center mt-2 text-black">
                File: {formData.mediaFile?.name}
              </p>
            </div>
          )}

          <div className="mt-6 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-700 mb-4">Campaign Schedule</h3>

            <div className="flex items-center justify-between gap-4 text-gray-800">
              {/* Start Date */}
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-5 h-5 text-green-500" />
                <span className="text-base ">
                  {formatDateForDisplay(formData.startDate)}
                </span>
              </div>

              {/* End Date */}
              <div className="flex items-center gap-2">
                <CalendarX2 className="w-5 h-5 text-red-500" />
                <span className="text-base">
                  {selectedPlan
                    ? formatDateForDisplay(
                        calculateEndDate(formData.startDate, selectedPlan.durationDays)
                      )
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Title/Description/Duration */}
        <div className="bg-white rounded-lg">
          <div className="mb-4">
          </div>
          <div className="space-y-2 text-sm text-gray-700">
            <div>
              <p className="text-xl font-bold mb-3 text-gray-600">{formData.title}</p>
            </div>
            <div>
              <p className="text-md mb-3 text-gray-600">{formData.description}</p>
            </div>
          </div>


        {/* Selected Plan & Material */}
        <div className="bg-white">
          {/* === Selected Plan & Material (Updated UI) === */}
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mt-10 bg-white">
            {/* Left: Plan Details */}
            <div className="space-y-4 text-gray-800 mt-5">
              {/* Plan */}
              <div className="flex items-center gap-2">
                <FileType className="w-6 h-6 text-gray-500" /> {/* Plan Icon */}
                <div className="flex flex-col">
                  <span className="font-bold text-md">{selectedPlan?.name}</span>
                </div>
              </div>

              {/* Vehicle Type */}
              <div className="flex items-center gap-2">
                <Car className="w-6 h-6 text-gray-500" /> {/* Vehicle Icon */}
                <div className="flex flex-col">
                  <span className="font-bold text-md">{selectedPlan?.vehicleType} <span className='text-sm font-medium'> Usage</span></span>
                </div>
              </div>

              {/* Material */}
              <div className="flex items-center gap-2">
                <View className="w-6 h-6 text-gray-500" /> {/* Material Icon */}
                <div className="flex flex-col">
                  <span className="font-bold text-md">
                    {materials.find(m => m.id === formData.materialId)?.materialType}
                  </span>
                </div>
              </div>

              {/* Devices */}
              <div className="flex items-center gap-2">
                <TabletSmartphone className="w-6 h-6 text-gray-500" /> {/* Devices Icon */}
                <div className="flex flex-col">
                  <span className="font-bold text-md">{selectedPlan?.numberOfDevices} <span className='text-sm font-medium'>Device/s</span></span>
                </div>
              </div>
            </div>


            {/* Right: Duration & Price */}
            <div className="flex flex-col items-center">
              {(() => {
                const duration = selectedPlan?.durationDays ?? 0;
                const maxDays = 120; // 🔵 Maximum days
                const percent = Math.min(duration / maxDays, 1);
                const radius = 46;
                const circumference = 2 * Math.PI * radius;
                const dashOffset = circumference * (1 - percent);

                return (
                  <div className="relative mr-16 w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx="50%" cy="50%" r={radius}
                        className="stroke-gray-200"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="50%" cy="50%" r={radius}
                        className="stroke-[#1B4F9C] transition-all duration-700"
                        strokeWidth="7"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col justify-center items-center">
                      <span className="text-xs text-gray-500">Duration</span>
                      <span className="text-lg font-bold text-gray-900">
                        {duration} days
                      </span>
                    </div>
                  </div>
                );
              })()}
              <p className="text-2xl mr-16 font-extrabold text-[#1B4F9C]">
                ₱{selectedPlan?.totalPrice.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
      {/* Agreement / Notice */}
      <div className="bg-blue-50 rounded-lg p-4 mt-10 text-sm w-auto text-blue-800">
        <p>
          By creating this advertisement, you agree to pay ₱{selectedPlan?.totalPrice.toLocaleString() + " "}
          for a {selectedPlan?.durationDays}-day campaign starting on {formatDateForDisplay(formData.startDate)}.
          Your advertisement will be submitted for review and you'll be notified once it's approved.
        </p>
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
        {currentStep === 2 && renderStep2(
          showMonthDropdown,
          setShowMonthDropdown,
          showYearDropdown,
          setShowYearDropdown
        )}
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
                  !canProceedToStep(currentStep + 1) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#feb011] text-white hover:bg-[#FF9B45]'
                }`}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceedToStep(currentStep) || isSubmitting}
                className={`px-4 py-2 rounded-md mr-16 w-60 ${
                  !canProceedToStep(currentStep) || isSubmitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#feb011] text-white hover:bg-[#FF9B45]'
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