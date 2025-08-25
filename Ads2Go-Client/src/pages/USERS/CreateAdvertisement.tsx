import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronRight, Upload, Play, Pause, Loader2 } from 'lucide-react';
import { GET_ALL_ADS_PLANS } from '../../graphql/queries/adsPlans';
import { CREATE_AD } from '../../graphql/mutations/createAd';

type AdsPlan = {
  _id: string;
  name: string;
  description: string;
  durationDays: number;
  totalPrice: number;
  materialType: string;
  vehicleType: string;
  numberOfDevices: number;
  adLengthSeconds: number;
  category: string;
  status: string;
};

type AdvertisementForm = {
  title: string;
  description: string;
  adType?: 'DIGITAL' | 'NON_DIGITAL'; // Made optional since it's determined by the plan
  planId: string;
  mediaFile?: File;
  mediaPreview?: string;
};

const CreateAdvertisement: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<AdsPlan | null>(null);
  const [formData, setFormData] = useState<AdvertisementForm>({
    title: '',
    description: '',
    planId: '',
  });
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

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
      // You might want to show an error message to the user here
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
        description: plan.description || `${plan.materialType} for ${plan.vehicleType}`,
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

  const handleSubmit = async () => {
    if (!selectedPlan) return;
    
    try {
      // Define the input type with all required fields
      const input: {
        title: string;
        description: string;
        materialId: string; // This should be the ID of the material, not the plan
        planId: string;
        price: number;
        status: string;
        startTime: string;
        endTime: string;
        mediaFile?: string;
      } = {
        title: formData.title,
        description: formData.description,
        materialId: selectedPlan.materialType || selectedPlan._id, // Use materialType as materialId
        planId: selectedPlan._id,
        price: selectedPlan.totalPrice,
        status: 'PENDING',
        startTime: new Date().toISOString(),
        endTime: new Date(
          new Date().getTime() + (selectedPlan.durationDays * 24 * 60 * 60 * 1000)
        ).toISOString()
      };

      // If we have a media file, we need to handle the upload separately
      if (formData.mediaFile) {
        // First upload the media file
        const mediaFormData = new FormData();
        mediaFormData.append('file', formData.mediaFile);
        
        console.log('Uploading file:', formData.mediaFile.name, 'Size:', formData.mediaFile.size, 'bytes');
        
        const mediaResponse = await fetch('http://localhost:5000/upload', {
          method: 'POST',
          body: mediaFormData,
          credentials: 'include',
          // Don't set Content-Type header, let the browser set it with the correct boundary
        });
        
        const responseData = await mediaResponse.json();
        console.log('Upload response:', responseData);
        
        if (!mediaResponse.ok) {
          throw new Error(responseData.error || 'Failed to upload media file');
        }
        
        // Use the filename from the response to construct the URL
        input.mediaFile = `/uploads/${responseData.filename}`;
      }

      // Then create the ad with the media URL
      await createAd({
        variables: {
          input
        }
      });
    } catch (error) {
      console.error('Error creating advertisement:', error);
    }
  };

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2:
        return selectedPlan !== null;
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
      {[1, 2, 3, 4].map((step) => (
        <React.Fragment key={step}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              currentStep >= step
                ? 'bg-[#251f70] text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step}
          </div>
          {step < 4 && (
            <div
              className={`w-16 h-1 ${
                currentStep > step ? 'bg-[#251f70]' : 'bg-gray-200'
              }`}
            />
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
                setFormData({ ...formData, planId: plan._id });
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
    </div>
  );

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
          </div>
        )}
      </div>
    </div>
  );

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

  const renderStep4 = () => (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">Review Advertisement</h2>
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
            <h3 className="text-lg font-semibold mb-4">Selected Plan</h3>
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
        <div className="flex items-center">
          <button
            onClick={() => navigate('/advertisements')}
            className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back to Advertisements
          </button>
          <h1 className="text-2xl font-semibold">Create Advertisement</h1>
        </div>
      </div>

      <div className="p-8">
        {renderStepIndicator()}
        
        <div className="bg-white rounded-lg shadow-sm p-8">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className={`flex items-center px-6 py-3 rounded-md ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceedToStep(currentStep + 1)}
              className={`flex items-center px-6 py-3 rounded-md ${
                canProceedToStep(currentStep + 1)
                  ? 'bg-[#251f70] text-white hover:bg-[#1b1853]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className={`bg-green-600 text-white px-8 py-3 rounded-md hover:bg-green-700 font-semibold ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isSubmitting}
            >
              Create Advertisement
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateAdvertisement;