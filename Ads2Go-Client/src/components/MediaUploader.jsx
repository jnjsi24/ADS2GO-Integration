import React, { useState } from 'react';
import { handleMediaUpload } from '../utils/mediaUploader';
import { useAuth } from '../contexts/AuthContext';

const MediaUploader = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const { currentUser } = useAuth();

  const onFileChange = async (event) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    setIsUploading(true);
    setUploadStatus({ type: 'info', message: 'Uploading media...' });

    try {
      const result = await handleMediaUpload(event, currentUser.uid);
      
      if (result.success) {
        setUploadStatus({
          type: 'success',
          message: 'Media uploaded successfully!',
          data: result
        });
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error.message || 'Failed to upload media'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Upload Media with Location</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select an image or video
        </label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={onFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
        />
      </div>

      {uploadStatus && (
        <div className={`p-3 rounded-md ${
          uploadStatus.type === 'error' ? 'bg-red-100 text-red-800' :
          uploadStatus.type === 'success' ? 'bg-green-100 text-green-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {uploadStatus.message}
          
          {uploadStatus.type === 'success' && uploadStatus.data && (
            <div className="mt-2 p-2 bg-white bg-opacity-50 rounded">
              <p className="text-sm">
                <strong>File URL:</strong>{' '}
                <a 
                  href={uploadStatus.data.downloadURL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {uploadStatus.data.downloadURL}
                </a>
              </p>
              {uploadStatus.data.metadata?.location && (
                <p className="text-sm mt-1">
                  <strong>Location:</strong>{' '}
                  {uploadStatus.data.metadata.location.latitude.toFixed(6)}, 
                  {uploadStatus.data.metadata.location.longitude.toFixed(6)}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {isUploading && (
        <div className="mt-4 flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
          <span>Uploading, please wait...</span>
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
