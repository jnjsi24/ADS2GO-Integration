import React from 'react';

// Placeholder component for heavy components during development
const PlaceholderComponent: React.FC<{ name: string }> = ({ name }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {name} Component
        </h2>
        <p className="text-gray-600 mb-4">
          This component is temporarily disabled to reduce memory usage during development.
        </p>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="text-sm">
            <strong>Note:</strong> This is a placeholder. The actual component will be loaded when memory issues are resolved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlaceholderComponent;
