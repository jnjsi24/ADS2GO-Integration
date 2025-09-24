import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { ChevronLeft, ChevronDown, CalendarCheck2, CalendarX2, FileType, View, ChevronRight, CloudUpload, Play, Pause, Loader2, Hourglass, Car, Clock, Monitor, TabletSmartphone } from 'lucide-react';
import { storage } from '../../firebase/init';
import { X, Video, Image as ImageIcon } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GET_ALL_ADS_PLANS } from '../../graphql/admin';
import { CREATE_AD } from '../../graphql/admin';
import { GET_PLAN_AVAILABILITY } from '../../graphql/admin/planAvailability';
import { GET_SMART_MATERIAL_SELECTION } from '../../graphql/user/queries/getSmartMaterialSelection';
import { motion, AnimatePresence } from "framer-motion";

type MaterialCategory = 'DIGITAL' | 'NON-DIGITAL';
type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';

type Material = {
  id: string;
  materialId: string;
  materialType: string;
  vehicleType: VehicleType;
  category: MaterialCategory;
};

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
  materials: Material[];
};

type AdvertisementForm = {
  title: string;
  description: string;
  website?: string; // Optional advertiser website
  adType?: 'DIGITAL' | 'NON_DIGITAL';
  planId: string;
  materialId: string;
  mediaFile: File | null;
  mediaPreview: string;
  startDate: string; // Changed from startTime to startDate for better UX
};



const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const apolloClient = useApolloClient();
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<AdsPlan | null>(null);
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [posNext, setPosNext] = useState({ x: 50, y: 50 });
  const [posSubmit, setPosSubmit] = useState({ x: 50, y: 50 });
  const [showToast, setShowToast] = useState(false);
  const [isSubmissionInProgress, setIsSubmissionInProgress] = useState(false); // New state to track submission
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // Prevent selecting past dates
    if (newDate < todayDate) {
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
    website: '', // Optional advertiser website
    planId: '',
    materialId: '',
    mediaFile: null,  // ✅ Add this
    mediaPreview: '', 
    startDate: new Date().toISOString().split('T')[0], // Default to today's date
  });

  const [materials, setMaterials] = useState<any[]>([]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ 
    plan?: string; 
    material?: string; 
    title?: string; 
    description?: string; 
    website?: string;
    startDate?: string; 
    mediaFile?: string; 
    general?: string;
  }>({});
  const [mediaDurationSec, setMediaDurationSec] = useState<number | null>(null);

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

  


  // Automatically select material using smart selection from server
  useEffect(() => {
    if (selectedPlan) {
      console.log('🔄 Selected plan:', selectedPlan.name, selectedPlan.materialType, selectedPlan.vehicleType, selectedPlan.category);
      console.log('🔄 Plan ID:', selectedPlan.id, 'Timestamp:', Date.now());
      
      // Clear any existing materials first
      setMaterials([]);
      setFormData(prev => ({ ...prev, materialId: '' }));
      
      // Use smart material selection from server instead of plan's materials array
      const fetchSmartMaterial = async () => {
        // Small delay to ensure state is cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          console.log('🚀 Calling smart material selection API...');
          console.log('📋 Request details:', {
            materialType: selectedPlan.materialType,
            vehicleType: selectedPlan.vehicleType,
            category: selectedPlan.category,
            timestamp: Date.now().toString()
          });
          
          // Use direct fetch to bypass Apollo Client cache completely
          const response = await fetch('http://localhost:5000/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('userToken')}`
            },
            body: JSON.stringify({
              query: `
                query GetSmartMaterialSelection($materialType: String!, $vehicleType: String!, $category: String!, $timestamp: String, $requestId: String) {
                  getSmartMaterialSelection(
                    materialType: $materialType
                    vehicleType: $vehicleType
                    category: $category
                    timestamp: $timestamp
                    requestId: $requestId
                  ) {
                    id
                    materialId
                    materialType
                    vehicleType
                    category
                    occupiedSlots
                    availableSlots
                    totalSlots
                    priority
                  }
                }
              `,
              variables: {
                materialType: selectedPlan.materialType,
                vehicleType: selectedPlan.vehicleType,
                category: selectedPlan.category,
                timestamp: Date.now().toString(),
                requestId: Math.random().toString(36).substring(7)
              }
            })
          });
          
          const result = await response.json();
          const data = result.data;

          console.log('📡 Smart selection API response:', data);
          console.log('📡 Raw response data:', JSON.stringify(data, null, 2));

          if (data.getSmartMaterialSelection) {
            const smartMaterial = data.getSmartMaterialSelection;
            console.log('📡 Smart material details:', JSON.stringify(smartMaterial, null, 2));
            setMaterials([smartMaterial]);
            setFormData(prev => ({ ...prev, materialId: smartMaterial.id }));
            console.log(`🎯 Smart selected material: ${smartMaterial.materialId} (${smartMaterial.occupiedSlots}/${smartMaterial.totalSlots} slots used)`);
          } else {
            console.log('⚠️ No smart material selection returned, using fallback');
            // Fallback to plan's materials if smart selection fails
            if (selectedPlan.materials && selectedPlan.materials.length > 0) {
              const selectedMaterial = selectedPlan.materials[0];
              setMaterials(selectedPlan.materials);
              setFormData(prev => ({ ...prev, materialId: selectedMaterial.id }));
              console.log(`🎯 Fallback to plan material: ${selectedMaterial.materialId}`);
            } else {
              setMaterials([]);
              setFormData(prev => ({ ...prev, materialId: '' }));
            }
          }
        } catch (error) {
          console.error('❌ Error fetching smart material selection:', error);
          // Fallback to plan's materials
          if (selectedPlan.materials && selectedPlan.materials.length > 0) {
            const selectedMaterial = selectedPlan.materials[0];
            setMaterials(selectedPlan.materials);
            setFormData(prev => ({ ...prev, materialId: selectedMaterial.id }));
            console.log(`🎯 Fallback to plan material: ${selectedMaterial.materialId}`);
          } else {
            setMaterials([]);
            setFormData(prev => ({ ...prev, materialId: '' }));
          }
        }
      };

      fetchSmartMaterial();
    } else {
      setMaterials([]);
      setFormData(prev => ({ ...prev, materialId: '' }));
    }
  }, [selectedPlan]);

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
      setIsSubmissionInProgress(false); // Reset submission state on success
      setShowToast(true);
      // Auto-hide after 3 seconds and navigate
      setTimeout(() => {
        setShowToast(false);
        navigate('/advertisements');
      }, 3000);
    },
    onError: (error) => {
      console.error('Error creating ad:', error);
      setIsSubmissionInProgress(false); // Reset submission state on error
      alert('Failed to create advertisement. Please try again.');
    }
  });

  // Transform the data to match the expected AdsPlan type
  const plans: AdsPlan[] = React.useMemo(() => {
    if (!data?.getAllAdsPlans) return [];
    
    console.log('Raw plans data:', data.getAllAdsPlans);
    
    return data.getAllAdsPlans
      .filter((plan: any) => {
        // Add null check to prevent errors
        if (!plan) return false;
        
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
        _id: plan?.id || '',
        name: plan?.name || '',
        description: plan?.description || '',
        durationDays: plan?.durationDays || 30,
        totalPrice: plan?.totalPrice || 0,
        materialType: plan?.materialType || '',
        vehicleType: plan?.vehicleType || 'CAR',
        numberOfDevices: plan?.numberOfDevices || 1,
        adLengthSeconds: plan?.adLengthSeconds || 30,
        category: plan?.category || 'DIGITAL',
        status: plan?.status || 'ACTIVE',
        materials: plan?.materials || []
      }));
  }, [data]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Require plan selected first to know allowed ad length for videos
      if (!selectedPlan) {
        setErrors(prev => ({ ...prev, mediaFile: 'Please select a plan first' }));
        return;
      }

      // Validate file type by extension
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'webm', 'avi'];
      const extension = (file.name.split('.').pop() || '').toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        setErrors(prev => ({ ...prev, mediaFile: 'Unsupported file type.' }));
        return;
      }

      // Dynamic file size limit
      let maxSizeMB = 50; // default for images and as baseline
      if (file.type.startsWith('video/')) {
        const adLen = selectedPlan?.adLengthSeconds || 30;
        // Heuristic limits by ad length
        if (adLen <= 20) maxSizeMB = 150;
        else if (adLen <= 30) maxSizeMB = 250;
        else if (adLen <= 60) maxSizeMB = 400;
        else maxSizeMB = 500;
      }
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        setErrors(prev => ({ ...prev, mediaFile: `File is too large. Maximum allowed size for this plan is ${maxSizeMB} MB.` }));
        return;
      }

      const previewUrl = URL.createObjectURL(file);

      // If video, check duration <= plan's adLengthSeconds
      if (file.type.startsWith('video/')) {
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        videoEl.src = previewUrl;
        videoEl.onloadedmetadata = () => {
          const duration = videoEl.duration; // in seconds
          setMediaDurationSec(duration);
          const maxAllowed = selectedPlan?.adLengthSeconds || 0;
          if (duration > maxAllowed + 0.2) { // small tolerance ~200ms
            setErrors(prev => ({ 
              ...prev, 
              mediaFile: `Video is too long. Maximum allowed length for this plan is ${maxAllowed} seconds.` 
            }));
            // Do not set the invalid file
            URL.revokeObjectURL(previewUrl);
            return;
          }

          // Valid video: set state
          setFormData({
            ...formData,
            mediaFile: file,
            mediaPreview: previewUrl
          });
          setErrors(prev => ({ ...prev, mediaFile: undefined }));
        };
        videoEl.onerror = () => {
          setErrors(prev => ({ ...prev, mediaFile: 'Could not load video metadata. Please try a different file.' }));
          URL.revokeObjectURL(previewUrl);
        };
        return; // wait for metadata before setting state
      }

      // Non-video: set immediately
      setMediaDurationSec(null);
      setFormData({
        ...formData,
        mediaFile: file,
        mediaPreview: previewUrl
      });
      setErrors(prev => ({ ...prev, mediaFile: undefined }));
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
    
    console.log('Form submission started', { formData, selectedPlan, isSubmissionInProgress, isSubmitting });
    
    // Prevent multiple submissions
    if (isSubmissionInProgress || isSubmitting) {
      console.log('Submission already in progress, returning');
      return;
    }
    
    setIsSubmissionInProgress(true);
    
    const newErrors: typeof errors = {};
    if (!selectedPlan) {
      newErrors.plan = 'Please select a plan first';
    }
    if (!formData.materialId) {
      newErrors.material = 'No suitable material found for the selected plan';
    }

    // Trimmed checks for text fields
    if (!formData.title || !formData.title.trim()) {
      newErrors.title = 'Please fill out this field';
    }
    if (!formData.description || !formData.description.trim()) {
      newErrors.description = 'Please fill out this field';
    }

    // Website validation (optional but must be valid URL if provided)
    if (formData.website && formData.website.trim()) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(formData.website.trim())) {
        newErrors.website = 'Please enter a valid URL starting with http:// or https://';
      }
    }

    if (!formData.mediaFile) {
      newErrors.mediaFile = 'Please upload a media file';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Please select a start date';
    }

    // Ensure start date is not in the past
    const startDateOnly = new Date(formData.startDate + 'T00:00:00.000Z');
    const todayDateOnly = new Date();
    todayDateOnly.setUTCHours(0, 0, 0, 0);
    if (startDateOnly < todayDateOnly) {
      newErrors.startDate = 'Please select a start date that is today or later';
    }

    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      console.log('Validation failed, resetting submission state');
      setIsSubmissionInProgress(false); // Reset submission state if validation fails
      return;
    }

    try {
      console.log('Starting submission process...');
      
      // Check plan availability before uploading media to avoid wasted uploads
      if (!selectedPlan) {
        console.log('No selected plan, setting error');
        setErrors(prev => ({ ...prev, plan: 'Please select a plan first' }));
        setIsSubmissionInProgress(false);
        return;
      }

      console.log('Checking plan availability for plan:', selectedPlan._id);
      const desiredStartIso = new Date(formData.startDate).toISOString();
      console.log('Desired start date ISO:', desiredStartIso);
      
      let availabilityData;
      try {
        const result = await apolloClient.query({
          query: GET_PLAN_AVAILABILITY,
          variables: { planId: selectedPlan._id, desiredStartDate: desiredStartIso },
          fetchPolicy: 'network-only',
        });
        availabilityData = result.data;
        console.log('Plan availability response:', availabilityData);
      } catch (availabilityError) {
        console.error('Error checking plan availability:', availabilityError);
        setErrors(prev => ({
          ...prev,
          plan: 'Failed to check plan availability. Please try again.',
        }));
        setIsSubmissionInProgress(false);
        return;
      }

      const canCreate = availabilityData?.getPlanAvailability?.canCreate;
      console.log('Can create ad?', canCreate);
      
      if (!canCreate) {
        const nextAvailable = availabilityData?.getPlanAvailability?.nextAvailableDate;
        const nextMsg = nextAvailable ? new Date(nextAvailable).toLocaleDateString() : 'Unknown';
        console.log('Plan not available, next available:', nextMsg);
        setErrors(prev => ({
          ...prev,
          plan: `No available materials or slots for selected plan. Next available: ${nextMsg}`,
        }));
        setIsSubmissionInProgress(false);
        return;
      }

      console.log('Plan is available, proceeding with media upload...');
      
      // Upload media file to Firebase Storage
      if (!formData.mediaFile) {
        console.log('No media file found');
        setErrors(prev => ({ ...prev, mediaFile: 'Please upload a media file' }));
        setIsSubmissionInProgress(false);
        return;
      }
      
      console.log('Uploading media file to Firebase...');
      let mediaFileURL;
      try {
        mediaFileURL = await uploadFileToFirebase(formData.mediaFile as File);
        console.log('Media uploaded successfully, URL:', mediaFileURL);
      } catch (uploadError) {
        console.error('Error uploading media file:', uploadError);
        setErrors(prev => ({
          ...prev,
          mediaFile: 'Failed to upload media file. Please try again.',
        }));
        setIsSubmissionInProgress(false);
        return;
      }

      // Determine ad format based on file type
      const fileExtension = (formData.mediaFile.name.split('.').pop() || '').toLowerCase();
      const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileExtension);
      
      // Calculate start and end times
      // Create date in UTC to avoid timezone conversion issues
      const startDateStr = formData.startDate; // YYYY-MM-DD format
      const [year, month, day] = startDateStr.split('-').map(Number);
      
      // Create date in UTC at midnight
      const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const startTime = startDate.toISOString();
      
      if (!selectedPlan) {
        setErrors(prev => ({ ...prev, plan: 'Please select a plan first' }));
        setIsSubmissionInProgress(false);
        return;
      }
      
      // Calculate end date in UTC
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + selectedPlan!.durationDays);
      endDate.setUTCHours(23, 59, 59, 999); // Set to end of day in UTC
      const endTime = endDate.toISOString();
      
      // Prepare the input for createAd mutation
      const input = {
        title: formData.title,
        description: formData.description,
        website: formData.website || null, // Include website if provided
        materialId: formData.materialId,
        planId: selectedPlan._id,
        adType: selectedPlan.category === 'DIGITAL' ? 'DIGITAL' : 'NON_DIGITAL',
        adFormat: isVideo ? 'VIDEO' : 'IMAGE',
        price: selectedPlan!.totalPrice,
        status: 'PENDING',
        startTime: startTime,
        endTime: endTime,
        mediaFile: mediaFileURL // Use Firebase download URL instead of local path
      };
      
      console.log('Date debugging:', {
        formDataStartDate: formData.startDate,
        startDate: startDate,
        startTime: startTime,
        endTime: endTime,
        now: new Date().toISOString(),
        today: new Date().toISOString().split('T')[0],
        startDateUTC: startDate.toISOString(),
        endDateUTC: endDate.toISOString()
      });

      // Create the ad with the Firebase media URL
      console.log('Calling createAd mutation with input:', input);
      console.log('Mutation variables:', { input });
      
      try {
        const result = await createAd({
          variables: { input },
        });
        console.log('createAd mutation completed successfully, result:', result);
      } catch (mutationError) {
        console.error('Error in createAd mutation:', mutationError);
        setErrors(prev => ({
          ...prev,
          general: 'Failed to create advertisement. Please try again.',
        }));
        setIsSubmissionInProgress(false);
        return;
      }

    } catch (error) {
      console.error('Error creating advertisement:', error);
      setIsSubmissionInProgress(false); // Reset submission state on error
      // Error handling is done in the mutation's onError callback
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
                  ? 'bg-[#1B5087] text-white font-bold'
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
      <h2 className="text-2xl font-semibold text-center">Choose Your Plan</h2>

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
        <>
          <div className="relative h-[650px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              {plans.map((plan, index) => {
                let transformClass = "scale-90 -z-10"; // hidden in back
                if (index === activePlanIndex) {
                  transformClass = "scale-105 z-20"; // front card
                } else if (index === (activePlanIndex + 1) % plans.length) {
                  transformClass = "translate-x-[60%] scale-95 z-10"; // right card
                } else if (index === (activePlanIndex - 1 + plans.length) % plans.length) {
                  transformClass = "translate-x-[-60%] scale-95 z-10"; // left card
                }

                return (
                  <div
                    key={plan._id}
                    className={`absolute mb- w-full max-w-sm border border-gray-100 h-[550px] transform transition-all duration-500 ${transformClass}`}
                    onClick={() => setActivePlanIndex(index)} // click side card to bring it front
                  >
                    <div
                      className={`p-6 cursor-pointer h-full flex flex-col justify-between transition-all
                        ${
                          selectedPlan?._id === plan._id
                          ? "backdrop-blur-md bg-white/30 border border-white/40 shadow-xl"
                          : "backdrop-blur-md bg-white/20 border border-white/30 hover:bg-white/30 shadow-lg"

                        }`}
                    >

                      {/* Price Section */}
                      <div className="">
                        <span className="text-4xl font-bold">
                          ₱{plan.totalPrice?.toLocaleString() || "N/A"}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">/on this advertisement</span>
                      </div>

                      {/* Plan Name */}
                      <h3 className="text-xl font-semibold">
                        {plan.name || "Street Pulse Ads"}
                      </h3>

                      {/* Description */}
                      <p className="text-gray-600 " 
                          style={{
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          }}>
                        {plan.description ||
                          "Turn downtime into brand time! For 30 days, your 20-second ad plays 160 times daily on 1 headrest LCD device—keeping passengers engaged every trip."}
                      </p>

                      {/* What is included */}
                      <div className="mt-6">
                        <p className="font-medium text-sm mb-3">What is included:</p>
                        <ul className="space-y-3 text-gray-700">
                          <li className="flex items-center">
                            <Clock className="w-5 h-5 mr-3" />
                            <span className='text-sm'>{plan.durationDays || "30"} days Duration</span>
                          </li>
                          <li className="flex items-center">
                            <Car className="w-5 h-5 mr-3" />
                            <span className='text-sm'>{plan.vehicleType || "CAR"}</span>
                          </li>
                          <li className="flex items-center">
                            <Monitor className="w-5 h-5 mr-3" />
                            <span className='text-sm'>{plan.materialType || "HEADREST"}</span>
                          </li>
                          <li className="flex items-center">
                            <TabletSmartphone className="w-5 h-5 mr-3" />
                            <span className='text-sm'>{plan.numberOfDevices || "1"} Device</span>
                          </li>
                          <li className="flex items-center">
                            <Hourglass className="w-5 h-5 mr-3" />
                            <span className='text-sm'>{plan.adLengthSeconds || "30"} seconds</span>
                          </li>
                        </ul>
                        {selectedPlan && index === activePlanIndex && (
                          <div className="mt-6 flex justify-center">
                            {formData.materialId ? (
                              <div className="bg-blue-200 p-3 w-80 text-center rounded-md text-[#1B5087]">
                                <p className="text-sm">
                                  There is a compatible material on this plan
                                </p>
                              </div>
                            ) : (
                              <div className="bg-red-100 p-3 w-80 text-center rounded-md text-red-700">
                                <p className="text-sm">
                                  There is no compatible material on this ad
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 w-16 h-16  flex items-center justify-center text-black/70 transition-all hover:scale-110"
              onClick={() =>
                setActivePlanIndex((prev) => (prev - 1 + plans.length) % plans.length)
              }
            >
              <ChevronLeft className="w-9 h-9" />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16  flex items-center justify-center text-black/70 transition-all hover:scale-110"
              onClick={() => setActivePlanIndex((prev) => (prev + 1) % plans.length)}
            >
              <ChevronRight className="w-9 h-9" />
            </button>
          </div>

          {/* Dots: moved outside the overflow-hidden div */}
          <div className="flex justify-center items-center space-x-3 mt-4">
            {plans.map((_, idx) => (
              <button
                key={idx}
                className={`w-2 h-2 rounded-md transition-all duration-300 ${
                  activePlanIndex === idx ? "bg-[#251f70] w-5" : "bg-gray-300"
                }`}
                onClick={() => setActivePlanIndex(idx)}
              />
            ))}
          </div>
        </>
      )}
    </div>
);


  // Step 2: Advertisement Details (previously step 3)
  const renderStep2 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Advertisement Details</h2>
      <div className="space-y-6">
        <div>
          <div className="relative mt-10">
            <input
              type="text"
              id="title"
              placeholder=" "
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${errors.title ? 'border-red-400' : 'border-gray-300'}`}
            />
            <label
              htmlFor="title"
              className={`absolute left-0 text-black transition-all duration-200 ${formData.title
                  ? '-top-2 text-sm text-black font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-bold`}
            >
              Advertisement Title 
            </label>
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">{errors.title}</p>
            )}
          </div>
        </div>
        <div>
          <div className="relative mt-10">
            <textarea
              id="description"
              placeholder=" "
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';            // Reset height first
                target.style.height = `${target.scrollHeight}px`; // Adjust to content
              }}
              className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent 
                focus:outline-none focus:border-blue-500 focus:ring-0 
                placeholder-transparent transition resize-none overflow-hidden
                ${errors.description ? 'border-red-400' : 'border-gray-300'}`}
            />
            <label
              htmlFor="description"
              className={`absolute left-0 text-black transition-all duration-200 ${
                formData.description
                  ? '-top-2 text-sm text-black font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
              } peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-bold`}
            >
              Description
            </label>
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
          </div>
        </div>
        <div>
          <div className="relative mt-10">
            <input
              type="url"
              id="website"
              placeholder=" "
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className={`peer w-full px-0 pt-5 pb-2 border-b bg-transparent
                focus:outline-none focus:border-blue-500 focus:ring-0
                placeholder-transparent transition
                ${errors.website ? 'border-red-400' : 'border-gray-300'}`}
            />
            <label
              htmlFor="website"
              className={`absolute left-0 text-black transition-all duration-200 ${
                formData.website
                  ? '-top-2 text-sm text-black font-bold'
                  : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500'
              } peer-focus:-top-2 peer-focus:text-sm peer-focus:text-black peer-focus:font-bold`}
            >
              Website URL (Optional)
            </label>

            <p className="text-sm text-gray-500 mt-2">
              If provided, QR codes will redirect to your website. Otherwise, they'll redirect to Ads2Go.
            </p>

            {errors.website && (
              <p className="text-sm text-red-600 mt-1">{errors.website}</p>
            )}
          </div>
        </div>
        <div>
  <label className="block text-sm font-bold text-gray-700 mb-2">
    Campaign Start Date *
  </label>

  <div className="relative">
    {/* Wrapping the calendar in motion for fade/slide animation */}
    <AnimatePresence mode="wait">
      <motion.div
        key={currentDate.toString()} // animate when month/year changes
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
        className="bg-white p-14"
      >
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={prevMonth}
            className="text-black pl-6 mb-7 hover:text-[#FF9B45]"
          >
            <ChevronLeft size={20} />
          </button>

          {/* MONTH Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowMonthDropdown(!showMonthDropdown)}
              className="flex items-center justify-between w-32 rounded-md text-[#1B5087] text-lg font-bold mb-7 bg-white border-none focus:outline-none cursor-pointer"
            >
              {[
                'January','February','March','April','May','June',
                'July','August','September','October','November','December'
              ][currentDate.getMonth()]}
              <ChevronDown
                size={20}
                className={`transform transition-transform duration-200 ${showMonthDropdown ? 'rotate-180' : ''}`}
              />
            </button>
            <AnimatePresence>
              {showMonthDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md overflow-hidden"
                >
                  {[
                    'January','February','March','April','May','June',
                    'July','August','September','October','November','December'
                  ].map((month, idx) => {
                    const isDisabled =
                      currentDate.getFullYear() === today.getFullYear() &&
                      idx < today.getMonth();
                    return (
                      <button
                        key={month}
                        disabled={isDisabled}
                        onClick={() => {
                          setCurrentDate(new Date(currentDate.getFullYear(), idx, 1));
                          setShowMonthDropdown(false);
                        }}
                        className={`block w-full bg-white text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : ''
                        }`}
                      >
                        {month}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* YEAR Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowMonthDropdown(false); // close month if open
              }}
              className="flex items-center justify-between w-28 rounded-md text-[#1B5087] text-lg font-bold mb-7 bg-white border-none focus:outline-none cursor-pointer"
            >
              {currentDate.getFullYear()}
              <ChevronDown
                size={20}
                className={`transform transition-transform duration-200 ${
                  showYearDropdown ? 'rotate-180' : ''
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
                  className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md overflow-hidden max-h-60 overflow-y-auto"
                >
                  {Array.from({ length: 6 }, (_, i) => today.getFullYear() - 1 + i).map(
                    (year) => (
                      <button
                        key={year}
                        disabled={year < today.getFullYear()}
                        onClick={() => {
                          if (year >= today.getFullYear()) {
                            setCurrentDate(new Date(year, currentDate.getMonth(), 1));
                            setShowYearDropdown(false);
                          }
                        }}
                        className={`block w-full bg-white text-left px-4 py-2 text-sm transition-colors duration-150 ${
                          year < today.getFullYear()
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {year}
                      </button>
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          <button
            onClick={nextMonth}
            className="text-black mb-7 pr-8 hover:text-[#FF9B45]"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center text-gray-700 border-b-2 pb-4 border-gray-300">
          {['SU','MO','TU','WE','TH','FR','SA'].map(day => (
            <div key={day} className="font-semibold text-sm">{day}</div>
          ))}
        </div>

        {/* Calendar Dates */}
        <div className="grid grid-cols-7 gap-1 text-center text-gray-700 pt-2">
          {getDaysInMonth(currentDate).map((day, index) => {
            const dayDate = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const isPast = dayDate ? dayDate < todayDate : false;

            return (
              <div
                key={index}
                onClick={() => !isPast && handleDateClick(day)}
                className={`
                  group relative cursor-pointer p-2 transition
                  ${
                    day
                      ? isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : selectedDate.getDate() === day &&
                          selectedDate.getMonth() === currentDate.getMonth() &&
                          selectedDate.getFullYear() === currentDate.getFullYear()
                        ? 'bg-[#1B5087] text-white'
                        : 'text-gray-800 hover:bg-gray-100'
                      : 'text-gray-300'
                  }
                `}
              >
                {/* DrawOutline hover animation */}
                <span className="absolute left-0 top-0 h-[2px] w-0 bg-gray-300 transition-all duration-100 group-hover:w-full" />
                <span className="absolute right-0 top-0 h-0 w-[2px] bg-gray-300 transition-all delay-100 duration-100 group-hover:h-full" />
                <span className="absolute bottom-0 right-0 h-[2px] w-0 bg-gray-300 transition-all delay-200 duration-100 group-hover:w-full" />
                <span className="absolute bottom-0 left-0 h-0 w-[2px] bg-gray-300 transition-all delay-300 duration-100 group-hover:h-full" />

                <span className="relative z-10">{day || ''}</span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  </div>

  {/* Campaign End Date Info */}
  {selectedPlan && formData.startDate && (
    <p className="text-sm text-gray-600 mt-2">
      Campaign will end on:{" "}
      <span className="font-bold">
        {formatDateForDisplay(calculateEndDate(formData.startDate, selectedPlan.durationDays))}
      </span>
    </p>
  )}

  {errors.startDate && (
    <p className="text-sm text-red-600 mt-2">{errors.startDate}</p>
  )}
</div>

      </div>
    </div>
  );
  // Step 3: Upload Media (previously step 4)
  const renderStep3 = () => (
  <div className="max-w-4xl mx-auto">
    <h2 className="text-2xl font-semibold mb-6 text-center">Upload Media</h2>

    {/* Flex Row: Upload (Left) + Preview (Right) */}
    <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
      {/* Drag & Drop Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileUpload({ target: { files: [file] } } as any);
        }}
        className={`flex flex-col justify-between flex-1 border-2 border-dashed shadow-inner rounded-md cursor-pointer transition p-8 min-h-[400px]
          ${isDragging ? "border-[#1B5087] bg-blue-50" : "border-gray-300 bg-white"}
        `}
      >
        {/* Hidden file input for Browse button */}
        <input
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm,video/x-msvideo"
          onChange={handleFileUpload}
          className="hidden"
          id="media-upload"
        />

        <div className="flex flex-col items-center justify-center h-full">
          <CloudUpload className="w-12 h-12 text-gray-400" />

          {/* Top text */}
          <p className="text-lg font-medium text-gray-700">Drag your files</p>

          {/* Divider with OR */}
          <div className="flex items-center w-full max-w-xs my-2">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="mx-3 text-gray-500 text-sm">or</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Browse Button */}
          <button
            type="button"
            onClick={() => document.getElementById("media-upload")?.click()}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setPos({ x, y }); // <-- Make sure you have: const [pos, setPos] = useState({ x: 50, y: 50 });
            }}
            className="relative group inline-flex items-center justify-center overflow-hidden
                      rounded-md px-6 py-2 text-sm font-medium text-white
                      transition-all duration-300 hover:scale-105 shadow-md"
            style={{
              backgroundImage: `linear-gradient(to right, #3674B5 0%, #1B5087 100%),
                                radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`,
            }}
          >
            <span className="relative z-10">Browse your files</span>

            {/* Light-blue shine that follows the mouse */}
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(173,216,230,0.5), transparent 60%)`,
              }}
            />
          </button>


          <p className="text-sm text-gray-500 mt-4 text-center">
            Supports: JPG, JPEG, PNG, MP4, MOV, WEBM, and AVI
          </p>
        </div>

        {errors.mediaFile && (
          <p className="text-xs text-center text-red-600">{errors.mediaFile}</p>
        )}
      </div>

      {/* Preview Section */}
      <div className="flex-1">
        {formData.mediaPreview ? (
          <>
            <h3 className="text-lg font-medium mb-4">Preview:</h3>
            <div className="border overflow-hidden">
              {formData.mediaFile?.type.startsWith("video/") ? (
                <div className="relative">
                  <video
                    src={formData.mediaPreview}
                    className="w-full h-64 object-cover"
                    controls={false}
                    muted
                    ref={(video) => {
                      if (video) {
                        if (isVideoPlaying) video.play();
                        else video.pause();
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
            {/* File Info with Icon, Progress, and Remove */}
            {formData.mediaFile && (
              <div className="mt-4 border border-gray-200 p-4 shadow-inner">
                {/* File Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {formData.mediaFile.type.startsWith("video/") ? (
                      <Video className="w-6 h-6 text-[#1B5087]" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#1B5087]" />
                    )}
                    <div className="text-sm text-gray-800">
                      <p className="truncate w-40">
                        <span className="font-semibold">{formData.mediaFile.name}</span>
                        <span className="text-xs text-gray-500 font-normal">
                          &nbsp;({(formData.mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        mediaFile: null,
                        mediaPreview: "",
                      }));
                      setUploadProgress(null);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Upload Progress Bar and Percentage */}
                {uploadProgress !== null ? (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1B5087] h-2 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-[#1B5087] font-bold text-right mt-1">
                      {uploadProgress}%
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="w-full bg-green-500 h-2 rounded-full"></div>
                    <div className="text-xs text-green-600 font-bold text-right mt-1">
                      Uploaded
                    </div>
                  </div>
                )}
              </div>
            )}

          </>
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-400 border rounded-md">
            <p className="text-sm">Preview will appear here</p>
          </div>
        )}
      </div>
    </div>

    {/* Upload Progress Indicator */}
    {uploadProgress !== null && (
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Uploading to Firebase...</span>
          <span>{uploadProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 h-2">
          <div
            className="bg-[#251f70] h-2 transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      </div>
    )}
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

          <div className="mt-6 rounded-lg p-">
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
      <div className="bg-yellow-100 rounded-lg p-4 mt-10 text-sm w-auto text-yellow-800">
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
          
          {errors.general && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200  ">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}
          
          <div className="mb-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </div>
          
          <div className="flex justify-between">
            {/* Previous Button */}
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className={`px-4 py-2 ml-16 w-60 rounded-md transition-all duration-300
                ${
                  currentStep === 1
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
              Previous
            </button>

            {/* Next Button */}
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceedToStep(currentStep + 1)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setPosNext({ x, y });
                }}
                className={`relative group inline-flex items-center justify-center overflow-hidden 
                  rounded-md px-4 py-2 mr-16 w-60 text-white text-sm font-medium
                  transition-all duration-300 
                  ${
                    !canProceedToStep(currentStep + 1)
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "hover:scale-105"
                  }`}
                style={
                  canProceedToStep(currentStep + 1)
                    ? {
                        backgroundImage: `linear-gradient(to right, #3674B5 0%, #1B5087 100%),
                          radial-gradient(circle at ${posNext.x}% ${posNext.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`
                      }
                    : {}
                }
              >
                Next
                {/* Shiny hover effect */}
                {canProceedToStep(currentStep + 1) && (
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at ${posNext.x}% ${posNext.y}%, rgba(173,216,230,0.5), transparent 60%)`
                    }}
                  />
                )}
              </button>
            ) : (
              /* Submit Button */
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  !canProceedToStep(currentStep) || isSubmitting || isSubmissionInProgress
                }
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setPosSubmit({ x, y });
                }}
                className={`relative group inline-flex items-center justify-center overflow-hidden 
                  rounded-md px-4 py-2 mr-16 w-60 text-white text-sm font-medium
                  transition-all duration-300
                  ${
                    !canProceedToStep(currentStep) || isSubmitting || isSubmissionInProgress
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "hover:scale-105"
                  }`}
                style={
                  !canProceedToStep(currentStep) || isSubmitting || isSubmissionInProgress
                    ? {}
                    : {
                        backgroundImage: `linear-gradient(to right, #3674B5 0%, #1B5087 100%),
                          radial-gradient(circle at ${posSubmit.x}% ${posSubmit.y}%, rgba(173,216,230,0), rgba(173,216,230,0))`
                      }
                }
              >
                {isSubmitting || isSubmissionInProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Advertisement"
                )}
                {/* Shiny hover effect */}
                {!(!canProceedToStep(currentStep) || isSubmitting || isSubmissionInProgress) && (
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at ${posSubmit.x}% ${posSubmit.y}%, rgba(173,216,230,0.5), transparent 60%)`
                    }}
                  />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        className={`fixed bottom-5 right-5 bg-[#251f70] text-white px-6 py-3  shadow-lg transform transition-all duration-500 ${
          showToast ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0'
        }`}
      >
        Advertisement created successfully!
      </div>
    </div>
  );
};

export default CreateAdvertisement;