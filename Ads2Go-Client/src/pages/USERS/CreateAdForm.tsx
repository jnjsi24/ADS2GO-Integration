import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { CREATE_AD } from '../../graphql/mutations/createAd';
import { useAuth } from '../../contexts/AuthContext';

const CreateAdForm: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [createAd, { loading, error }] = useMutation(CREATE_AD);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vehicleType: '',
    materialsUsed: '',
    adFormat: '',
    plan: '',
    mediaFile: null as File | null,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({
        ...prev,
        mediaFile: e.target.files![0]
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data } = await createAd({
        variables: {
          input: {
            ...formData,
            price: 0, // You'll need to calculate this based on your pricing logic
            status: 'PENDING',
            userId: user?.userId,
          }
        }
      });
      
      if (data?.createAd) {
        navigate('/advertisements');
      }
    } catch (err) {
      console.error('Error creating ad:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 pt-10">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Create New Advertisement</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          {/* Vehicle Type */}
          <div>
            <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700">
              Vehicle Type *
            </label>
            <select
              id="vehicleType"
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select Vehicle Type</option>
              <option value="Car">Car</option>
              <option value="Motor">Motor</option>
              <option value="Jeep">Jeep</option>
              <option value="Bus">Bus</option>
            </select>
          </div>

          {/* Materials Used */}
          <div>
            <label htmlFor="materialsUsed" className="block text-sm font-medium text-gray-700">
              Materials Used *
            </label>
            <select
              id="materialsUsed"
              name="materialsUsed"
              value={formData.materialsUsed}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select Material</option>
              <option value="LCD Screen">LCD Screen</option>
              <option value="Posters">Posters</option>
              <option value="Vinyl Sticker">Vinyl Sticker</option>
            </select>
          </div>

          {/* Plan */}
          <div>
            <label htmlFor="plan" className="block text-sm font-medium text-gray-700">
              Plan *
            </label>
            <select
              id="plan"
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select Plan</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          {/* Ad Format */}
          <div>
            <label htmlFor="adFormat" className="block text-sm font-medium text-gray-700">
              Ad Format *
            </label>
            <select
              id="adFormat"
              name="adFormat"
              value={formData.adFormat}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select Format</option>
              <option value="Image">Image</option>
              <option value="Video">Video</option>
            </select>
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Media File *
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
                      onChange={handleFileChange}
                      accept="image/*,video/*"
                      required
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  {formData.adFormat === 'Image' 
                    ? 'PNG, JPG, GIF up to 10MB' 
                    : 'MP4, MOV up to 50MB'}
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-600 text-sm">
              Error: {error.message}
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAdForm;
