import React, { useState } from 'react';
import LocationAutocomplete from './LocationAutocomplete';

const LocationDemo: React.FC = () => {
  const [companyAddress, setCompanyAddress] = useState('');
  const [houseAddress, setHouseAddress] = useState('');

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Enhanced Location Autocomplete Demo</h2>
      <p className="text-gray-600 text-center mb-6">
        Now with cities, barangays, and postal codes! Try selecting a region, then city, then barangay.
      </p>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3">Company Address</h3>
          <LocationAutocomplete
            label="Company Address"
            value={companyAddress}
            onChange={setCompanyAddress}
            placeholder="Select company location..."
            required
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-3">House Address</h3>
          <LocationAutocomplete
            label="House Address"
            value={houseAddress}
            onChange={setHouseAddress}
            placeholder="Select house location..."
            required
          />
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-3 text-lg">Selected Values:</h3>
        <div className="space-y-2">
          <div>
            <strong className="text-blue-600">Company:</strong> 
            <span className="ml-2 text-gray-700">{companyAddress || 'None selected'}</span>
          </div>
          <div>
            <strong className="text-green-600">House:</strong> 
            <span className="ml-2 text-gray-700">{houseAddress || 'None selected'}</span>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
          <h4 className="font-semibold text-blue-800 mb-2">✨ New Features:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Postal Codes:</strong> Shows postal codes for cities and barangays</li>
            <li>• <strong>Hierarchical Selection:</strong> Region → City → Barangay</li>
            <li>• <strong>Complete Address:</strong> Displays full address with postal code</li>
            <li>• <strong>Visual Indicators:</strong> Clear type labels and postal code display</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LocationDemo;
