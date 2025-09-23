import React, { useState, useRef, useEffect } from 'react';
import { MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import philippinesData from '../data/philippines-locations.json';

interface LocationOption {
  id: string;
  name: string;
  type: 'region' | 'city' | 'barangay';
  parentId?: string;
  postalCode?: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
}

// Convert JSON data to flat array for easier searching
const locationData: LocationOption[] = [];

philippinesData.regions.forEach(region => {
  // Add region
  locationData.push({
    id: region.id,
    name: region.name,
    type: 'region'
  });

  // Add cities
  region.cities.forEach(city => {
    locationData.push({
      id: city.id,
      name: city.name,
      type: 'city',
      parentId: region.id,
      postalCode: city.postalCode
    });

    // Add barangays
    city.barangays.forEach(barangay => {
      const barangayName = typeof barangay === 'string' ? barangay : barangay.name;
      const barangayPostalCode = typeof barangay === 'string' ? undefined : barangay.postalCode;
      
      locationData.push({
        id: `${city.id}_${barangayName.toLowerCase().replace(/\s+/g, '_')}`,
        name: barangayName,
        type: 'barangay',
        parentId: city.id,
        postalCode: barangayPostalCode
      });
    });
  });
});

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Select location...",
  label,
  required = false,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<LocationOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isClickingDropdown = useRef(false);

  // Filter options based on search term and hierarchy
  const filterOptions = (searchTerm: string) => {
    const term = searchTerm.toLowerCase();
    
    // If a barangay is selected, don't show more options
    if (selectedBarangay) {
      return [];
    }

    // If a city is selected, show barangays in that city
    if (selectedCity) {
      return locationData.filter(item => 
        item.parentId === selectedCity && item.type === 'barangay'
      );
    }

    // If a region is selected, show cities in that region
    if (selectedRegion) {
      return locationData.filter(item => 
        item.parentId === selectedRegion && item.type === 'city'
      );
    }

    // If no selections, show regions or filter by search term
    if (!term) {
      return locationData.filter(item => item.type === 'region');
    }

    // Filter by search term
    return locationData.filter(item => 
      item.name.toLowerCase().includes(term)
    );
  };

  useEffect(() => {
    const filtered = filterOptions(value);
    setFilteredOptions(filtered);
  }, [value, selectedRegion, selectedCity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // If user is typing and we have complete location selection, allow editing
    if (selectedRegion && selectedCity && selectedBarangay) {
      // User is editing the address part, keep the location selection
      onChange(newValue);
      return;
    }
    
    // If user is typing and we have incomplete location selections, clear them
    if (newValue && (selectedRegion || selectedCity)) {
      setSelectedRegion(null);
      setSelectedCity(null);
      setSelectedBarangay(null);
      setIsLocationSelected(false);
    }
    
    onChange(newValue);
    
    // Show dropdown if there's text and no location selected
    if (newValue && !selectedRegion) {
      setIsOpen(true);
    } else if (!newValue) {
      setSelectedRegion(null);
      setSelectedCity(null);
      setSelectedBarangay(null);
      setIsLocationSelected(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      // If we have a city selected, go back to region
      if (selectedCity) {
        e.preventDefault();
        setSelectedCity(null);
        setIsOpen(true);
        return;
      }
      
      // If we have a region selected, go back to start
      if (selectedRegion) {
        e.preventDefault();
        setSelectedRegion(null);
        setIsOpen(true);
        return;
      }
    }
  };

  const clearSelection = () => {
    setSelectedRegion(null);
    setSelectedCity(null);
    setSelectedBarangay(null);
    setIsLocationSelected(false);
    setUserAddress('');
    setIsEditingAddress(false);
    onChange('');
    setIsOpen(false);
  };

  const updateMainValue = () => {
    if (selectedRegion && selectedCity && selectedBarangay) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const cityName = locationData.find(c => c.id === selectedCity)?.name;
      const barangayName = locationData.find(b => b.id === selectedBarangay)?.name;
      const barangayPostalCode = locationData.find(b => b.id === selectedBarangay)?.postalCode;
      const locationPart = `${regionName}, ${cityName}, ${barangayName}${barangayPostalCode ? ` (${barangayPostalCode})` : ''}`;
      const fullAddress = userAddress ? `${userAddress}, ${locationPart}` : locationPart;
      onChange(fullAddress);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setUserAddress(newAddress);
    setIsEditingAddress(true);
    updateMainValue();
  };

  const handleOptionSelect = (option: LocationOption) => {
    if (option.type === 'region') {
      setSelectedRegion(option.id);
      setSelectedCity(null);
      setSelectedBarangay(null);
      setIsLocationSelected(false);
      setUserAddress('');
      onChange(option.name);
      // Keep dropdown open to show cities
      setTimeout(() => setIsOpen(true), 0);
    } else if (option.type === 'city') {
      setSelectedCity(option.id);
      setSelectedBarangay(null);
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const displayValue = `${regionName}, ${option.name}${option.postalCode ? ` (${option.postalCode})` : ''}`;
      onChange(displayValue);
      // Keep dropdown open to show barangays
      setTimeout(() => setIsOpen(true), 0);
    } else if (option.type === 'barangay') {
      setSelectedBarangay(option.id);
      setIsLocationSelected(true);
      // Close dropdown after selecting barangay
      setIsOpen(false);
      // Update the main value with current user address + location
      updateMainValue();
    }
  };

  const handleInputFocus = () => {
    // Only open dropdown if location selection is not complete
    if (!isLocationSelected || !selectedBarangay) {
      setIsOpen(true);
    }
  };

  const handleInputClick = () => {
    // Allow re-opening dropdown even after location is selected
    if (isLocationSelected && selectedBarangay) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay closing to allow option selection
    setTimeout(() => {
      if (!isClickingDropdown.current) {
        setIsOpen(false);
      }
      isClickingDropdown.current = false;
    }, 200);
  };

  const handleDropdownMouseDown = () => {
    isClickingDropdown.current = true;
  };

  const getLocationDisplay = () => {
    if (selectedRegion && selectedCity && selectedBarangay) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const cityName = locationData.find(c => c.id === selectedCity)?.name;
      const barangayName = locationData.find(b => b.id === selectedBarangay)?.name;
      const barangayPostalCode = locationData.find(b => b.id === selectedBarangay)?.postalCode;
      return `${regionName}, ${cityName}, ${barangayName}${barangayPostalCode ? ` (${barangayPostalCode})` : ''}`;
    } else if (selectedRegion && selectedCity) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const city = locationData.find(c => c.id === selectedCity);
      const cityName = city?.name;
      const cityPostalCode = city?.postalCode;
      return `${regionName}, ${cityName}${cityPostalCode ? ` (${cityPostalCode})` : ''}`;
    } else if (selectedRegion) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      return regionName;
    }
    return '';
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Inline Address Builder */}
      <div className="space-y-3">
        {/* Location Selection */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={getLocationDisplay() || value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onClick={handleInputClick}
            placeholder="Select location..."
            className={`w-full px-3 py-2 pr-20 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
            {(selectedRegion || selectedCity) && (
              <button
                type="button"
                onClick={clearSelection}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Clear selection"
              >
                <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
            <MapPinIcon className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        {/* Address Input - Only show when location is selected */}
        {isLocationSelected && selectedRegion && selectedCity && selectedBarangay && (
          <div className="flex items-center space-x-2">
            <div className="flex-1">
              <input
                type="text"
                value={userAddress}
                onChange={handleAddressChange}
                placeholder="Enter your house number and street..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-md border">
              <span className="font-medium">+</span>
            </div>
            <div className="flex-1">
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                {getLocationDisplay()}
              </div>
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          onMouseDown={handleDropdownMouseDown}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {/* Breadcrumb navigation */}
          {(selectedRegion || selectedCity) && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Navigation:</span>
                  {selectedRegion && (
                    <button
                      onClick={() => {
                        setSelectedCity(null);
                        setIsOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {locationData.find(r => r.id === selectedRegion)?.name}
                    </button>
                  )}
                  {selectedCity && (
                    <>
                      <span className="text-gray-400">→</span>
                      <button
                        onClick={() => {
                          setSelectedCity(null);
                          setIsOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {locationData.find(c => c.id === selectedCity)?.name}
                      </button>
                    </>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  Press ← to go back
                </span>
              </div>
            </div>
          )}
          
          {/* Options list */}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => handleOptionSelect(option)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{option.name}</span>
                  {option.postalCode && (
                    <span className="text-xs text-blue-600">Postal Code: {option.postalCode}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 capitalize">
                  {option.type}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-2 text-gray-500 text-sm">
              No options available
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default LocationAutocomplete;
