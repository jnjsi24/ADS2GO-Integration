import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronRight, Upload, Play, Pause, Loader2 } from 'lucide-react';
import { storage } from '../../firebase/init';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GET_ALL_ADS_PLANS } from '../../graphql/queries/adsPlans';
import { GET_MATERIALS_BY_CATEGORY_AND_VEHICLE } from '../../graphql/queries/materials';
import { CREATE_AD } from '../../graphql/mutations/createAd';

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
  startTime?: string;
};

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<AdsPlan | null>(null);
  const [formData, setFormData] = useState<AdvertisementForm>({
    title: '',
    description: '',
    planId: '',
    materialId: '',
  });
  const [materials, setMaterials] = useState<any[]>([]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
        // Automatically select the first available material
        const firstMaterial = data.getMaterialsByCategoryAndVehicle[0];
        setFormData(prev => ({ ...prev, materialId: firstMaterial?.id || '' }));
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

    try {
      // Upload media file to Firebase Storage
      const mediaFileURL = await uploadFileToFirebase(formData.mediaFile);

      // Determine ad format based on file type
      const fileExtension = formData.mediaFile?.name.split('.').pop()?.toLowerCase() || '';
      const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileExtension);
      
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
        startTime: formData.startTime || new Date().toISOString(),
        endTime: new Date(
          (formData.startTime ? new Date(formData.startTime) : new Date()).getTime() +
          selectedPlan.durationDays * 24 * 60 * 60 * 1000
        ).toISOString(),
        mediaFile: mediaFileURL // Use Firebase download URL instead of local path
      };

      // Create the ad with the Firebase media URL
      await createAd({
        variables: { input },
      });

      // Show success message and navigate back to advertisements page
      alert('Advertisement created successfully!');
      navigate('/advertisements');
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
        return formData.title && formData.description;
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
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep > index + 1 || (currentStep === index + 1 && canProceedToStep(currentStep))
                  ? 'bg-[#251f70] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
            <span className="text-xs mt-1 text-gray-600">{step}</span>
          </div>
          {index < 3 && (
            <div className="w-16 h-1 bg-gray-200 mx-2 mt-4">
              <div
                className={`h-full ${
                  currentStep > index + 1 ? 'bg-[#251f70]' : 'bg-gray-200'
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                selectedPlan?._id === plan._id
                  ? 'border-[#251f70] bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedPlan(plan);
                setFormData({ 
                  ...formData, 
                  planId: plan._id,
                  adType: plan.category === 'DIGITAL' ? 'DIGITAL' : 'NON_DIGITAL'
                });
              }}
            >
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
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
                    <span className="text-[#251f70]">₱{plan.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show automatic material selection status */}
      {selectedPlan && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-800 mb-2">Automatic Material Selection</h3>
          {loadingMaterials ? (
            <div className="flex items-center text-blue-700">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Finding compatible materials...
            </div>
          ) : formData.materialId ? (
            <div className="text-blue-700">
              <p className="text-sm">
                ✓ Compatible material automatically selected for your {selectedPlan.category} plan 
                on {selectedPlan.vehicleType} vehicles.
              </p>
              {materials.length > 0 && (
                <p className="text-sm mt-1">
                  Material ID: {materials.find(m => m.id === formData.materialId)?.materialId}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Advertisement Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#251f70]"
            placeholder="Enter advertisement title"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#251f70] h-32"
            placeholder="Describe your advertisement"
            required
          />
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
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Review & Submit</h2>
      <div className="space-y-6">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Advertisement Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Title:</span>
              <p className="text-gray-600">{formData.title}</p>
            </div>
            <div>
              <span className="font-medium">Type:</span>
              <p className="text-gray-600">{formData.adType}</p>
            </div>
            <div className="col-span-2">
              <span className="font-medium">Description:</span>
              <p className="text-gray-600">{formData.description}</p>
            </div>
          </div>
        </div>

        {selectedPlan && (
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Selected Plan & Material</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Plan:</span>
                <p className="text-gray-600">{selectedPlan.name}</p>
              </div>
              <div>
                <span className="font-medium">Duration:</span>
                <p className="text-gray-600">{selectedPlan.durationDays} days</p>
              </div>
              <div>
                <span className="font-medium">Vehicle Type:</span>
                <p className="text-gray-600">{selectedPlan.vehicleType}</p>
              </div>
              <div>
                <span className="font-medium">Material:</span>
                <p className="text-gray-600">{selectedPlan.materialType}</p>
              </div>
              <div>
                <span className="font-medium">Devices:</span>
                <p className="text-gray-600">{selectedPlan.numberOfDevices}</p>
              </div>
              <div>
                <span className="font-medium">Total Price:</span>
                <p className="text-[#251f70] font-bold">₱{selectedPlan.totalPrice.toLocaleString()}</p>
              </div>
              {materials.length > 0 && formData.materialId && (
                <div className="col-span-2">
                  <span className="font-medium">Auto-selected Material:</span>
                  <p className="text-gray-600">
                    {materials.find(m => m.id === formData.materialId)?.materialType} 
                    (ID: {materials.find(m => m.id === formData.materialId)?.materialId})
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {formData.mediaPreview && (
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Media Preview</h3>
            <div className="border rounded-lg overflow-hidden">
              {formData.mediaFile?.type.startsWith('video/') ? (
                <video
                  src={formData.mediaPreview}
                  className="w-full h-48 object-cover"
                  controls
                />
              ) : (
                <img
                  src={formData.mediaPreview}
                  alt="Media preview"
                  className="w-full h-48 object-cover"
                />
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              File: {formData.mediaFile?.name}
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            By creating this advertisement, you agree to pay ₱{selectedPlan?.totalPrice.toLocaleString()} 
            for a {selectedPlan?.durationDays}-day campaign. Your advertisement will be submitted for review 
            and you'll be notified once it's approved.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 pl-60 pb-6 bg-gray-50 min-h-screen">
      <div className="bg-white p-6 shadow">
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/advertisements')}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back to Advertisements
          </button>
          <h1 className="text-2xl font-bold ml-4">Create New Advertisement</h1>
        </div>
        
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md">
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
              className={`px-4 py-2 rounded-md ${
                currentStep === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Previous
            </button>
            
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceedToStep(currentStep + 1)}
                className={`px-4 py-2 rounded-md ${
                  !canProceedToStep(currentStep + 1) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#251f70] text-white hover:bg-[#1a1652]'
                }`}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canProceedToStep(currentStep) || isSubmitting}
                className={`px-4 py-2 rounded-md flex items-center ${
                  !canProceedToStep(currentStep) || isSubmitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#251f70] text-white hover:bg-[#1a1652]'
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
    </div>
  );
};

export default CreateAdvertisement;