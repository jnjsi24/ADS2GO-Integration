import React from 'react';

interface SubtleLoaderProps {
  message?: string;
}

const SubtleLoader: React.FC<SubtleLoaderProps> = ({ message = "Refreshing..." }) => {
  return (
    <div className="flex items-center justify-center py-2 px-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-600">{message}</span>
      </div>
    </div>
  );
};

export default SubtleLoader;
