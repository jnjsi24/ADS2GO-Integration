import React, { useState, useCallback } from 'react';
import { uploadDriverDocument, uploadMediaWithLocation } from '../utils/mediaUploader';
import { useAuth } from '../contexts/AuthContext';
import { FaUpload, FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';

const MediaUploader = ({ documentType, onUploadComplete, label = 'Select a file', accept = 'image/*,video/*', showPreview = true }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { currentUser } = useAuth();

  const resetUploader = useCallback(() => {
    setPreviewUrl(null);
    setUploadStatus(null);
  }, []);

  const onFileChange = async (event) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    setIsUploading(true);
    setUploadStatus({ type: 'info', message: 'Uploading file...' });

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    try {
      let result;
      
      if (documentType) {
        // Handle driver document upload
        result = await uploadDriverDocument(file, documentType, currentUser?.uid || 'anonymous');
      } else {
        // Handle regular media upload with location (legacy)
        const location = await getCurrentLocation();
        result = await uploadMediaWithLocation(file, location, currentUser?.uid || 'anonymous');
      }
      
      if (result.success) {
        const successMessage = documentType 
          ? `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} uploaded successfully!`
          : 'Media uploaded successfully!';
        
        setUploadStatus({
          type: 'success',
          message: successMessage,
          data: result
        });
        
        // Notify parent component about successful upload
        if (onUploadComplete) {
          onUploadComplete({
            url: result.url || result.downloadURL,
            metadata: result.metadata || {}
          });
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error.message || 'Failed to upload file'
      });
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Reset file input
    }
  };

  const getStatusIcon = () => {
    if (isUploading) return <FaSpinner className="animate-spin mr-2" />;
    if (uploadStatus?.type === 'success') return <FaCheckCircle className="text-green-500 mr-2" />;
    if (uploadStatus?.type === 'error') return <FaTimesCircle className="text-red-500 mr-2" />;
    return <FaUpload className="mr-2" />;
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center w-full">
        <label 
          htmlFor="file-upload" 
          className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer 
            ${isUploading ? 'border-gray-300 bg-gray-50' : 'border-blue-300 hover:border-blue-400 bg-white'}
            transition-colors duration-200`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {getStatusIcon()}
            <p className="mb-2 text-sm text-gray-500">
              {isUploading ? (
                <span>Uploading...</span>
              ) : uploadStatus?.type === 'success' ? (
                <span className="text-green-600 font-medium">{uploadStatus.message}</span>
              ) : uploadStatus?.type === 'error' ? (
                <span className="text-red-600">{uploadStatus.message}</span>
              ) : (
                <>
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </>
              )}
            </p>
            <p className="text-xs text-gray-500">{label} ({accept})</p>
          </div>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="hidden"
            accept={accept}
            onChange={onFileChange}
            disabled={isUploading}
          />
        </label>
      </div>

      {showPreview && previewUrl && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
          <div className="relative w-full h-48 bg-gray-100 rounded-md overflow-hidden">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {uploadStatus?.type === 'success' && (
        <div className="mt-4 p-3 bg-green-50 text-green-800 text-sm rounded-md">
          <p>File uploaded successfully!</p>
          {uploadStatus.data?.url && (
            <p className="mt-1 truncate">
              URL: <a href={uploadStatus.data.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {uploadStatus.data.url}
              </a>
            </p>
          )}
          <button
            onClick={resetUploader}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Upload a different file
          </button>
        </div>
      )}

      {uploadStatus?.type === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-800 text-sm rounded-md">
          <p>Error: {uploadStatus.message}</p>
          <button
            onClick={resetUploader}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};

MediaUploader.defaultProps = {
  documentType: null,
  onUploadComplete: null,
  label: 'Select a file',
  accept: 'image/*',
  showPreview: true
};

export default MediaUploader;
