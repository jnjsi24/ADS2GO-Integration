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
  addressLabel?: string;
  required?: boolean;
  error?: string;
  addressPlaceholder?: string;
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
  addressLabel = "Enter your house number and street...",
  required = false,
  error,
  addressPlaceholder = "Enter your house number and street..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<LocationOption[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Get the location part string
  const getLocationPart = () => {
    if (selectedRegion && selectedCity && selectedBarangay) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const cityName = locationData.find(c => c.id === selectedCity)?.name;
      const barangayName = locationData.find(b => b.id === selectedBarangay)?.name;
      const barangayPostalCode = locationData.find(b => b.id === selectedBarangay)?.postalCode;
      return `${barangayName}${barangayPostalCode ? ` (${barangayPostalCode})` : ''}, ${cityName}, ${regionName}`;
    }
    return '';
  };

  // Extract location parts and user address from value when component mounts or value changes
  useEffect(() => {
    // Don't extract if user is actively editing the address field
    if (isEditingAddress) {
      return;
    }
    
    if (value) {
      const locationPart = getLocationPart();
      
      // If we have a complete location selected and the value contains it
      if (locationPart && value.includes(locationPart)) {
        // Extract user address (house number and street) - part before the location
        // Only trim leading/trailing spaces, preserve internal spaces
        let addressPart = value.replace(locationPart, '').replace(/,\s*$/, '');
        addressPart = addressPart.trimStart().trimEnd();
        if (addressPart && addressPart !== userAddress) {
          setUserAddress(addressPart);
        }
      } else {
        // Try to extract location from value and set selections
        const regions = locationData.filter(item => item.type === 'region');
        const cities = locationData.filter(item => item.type === 'city');
        const barangays = locationData.filter(item => item.type === 'barangay');
        
        // Find region
        const foundRegion = regions.find(region => 
          value.includes(region.name)
        );
        
        if (foundRegion) {
          setSelectedRegion(foundRegion.id);
          
          // Find city
          const foundCity = cities.find(city => 
            city.parentId === foundRegion.id && value.includes(city.name)
          );
          
          if (foundCity) {
            setSelectedCity(foundCity.id);
            
            // Find barangay
            const foundBarangay = barangays.find(barangay => 
              barangay.parentId === foundCity.id && value.includes(barangay.name)
            );
            
            if (foundBarangay) {
              setSelectedBarangay(foundBarangay.id);
              setIsLocationSelected(true);
              
              // Extract user address
              const extractedLocationPart = `${foundBarangay.name}${foundBarangay.postalCode ? ` (${foundBarangay.postalCode})` : ''}, ${foundCity.name}, ${foundRegion.name}`;
              // Only trim leading/trailing spaces, preserve internal spaces
              let addressPart = value.replace(extractedLocationPart, '').replace(/,\s*$/, '');
              addressPart = addressPart.trimStart().trimEnd();
              if (addressPart && addressPart !== userAddress) {
                setUserAddress(addressPart);
              }
            }
          }
        }
      }
    }
  }, [value, isEditingAddress]); // Only depend on value, not userAddress

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

  const updateMainValue = (customAddress?: string) => {
    if (selectedRegion && selectedCity && selectedBarangay) {
      const locationPart = getLocationPart();
      const addressToUse = customAddress ?? userAddress;
      const fullAddress = addressToUse ? `${addressToUse}, ${locationPart}` : locationPart;
      onChange(fullAddress);
    }
  };


  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    
    // Update local state immediately
    setUserAddress(newAddress);
    setIsEditingAddress(true);
    
    // Call parent onChange immediately
    if (selectedRegion && selectedCity && selectedBarangay) {
      const locationPart = getLocationPart();
      if (newAddress.trim() === '') {
        onChange(locationPart);
      } else {
        onChange(`${newAddress}, ${locationPart}`);
      }
    } else {
      onChange(newAddress);
    }
  };



  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only prevent default for Enter key to avoid form submission
    if (e.key === 'Enter') {
      e.preventDefault();
    }
    
    // For space key, ensure it's not prevented
    if (e.key === ' ') {
      // Allow the space to be processed normally
      return;
    }
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
      // Format: City, Region (temporary display while selecting)
      const displayValue = `${option.name}, ${regionName}`;
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
      return getLocationPart();
    } else if (selectedRegion && selectedCity) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const city = locationData.find(c => c.id === selectedCity);
      const cityName = city?.name;
      // Format: City, Region (while selecting)
      return `${cityName}, ${regionName}`;
    } else if (selectedRegion) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      return regionName;
    }
    return '';
  };

  // Determine if we should show the address input field
  const shouldShowAddressInput = (selectedRegion && selectedCity && selectedBarangay) || 
    (value && value.includes('(') && value.includes(')') && value.includes(',') && 
     (value.includes('National Capital Region') || value.includes('Region') || value.includes('Province')));

  return (
    <>
      <style>
        {`
          .location-input input[type="text"] {
            background-color: transparent !important;
            color: white !important;
          }
          .location-input input[type="text"]:focus {
            background-color: transparent !important;
            color: white !important;
          }
          .location-input input::placeholder {
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .location-input input:-webkit-autofill,
          .location-input input:-webkit-autofill:hover,
          .location-input input:-webkit-autofill:focus,
          .location-input input:-webkit-autofill:active {
            -webkit-background-clip: text;
            -webkit-text-fill-color: white;
            transition: background-color 5000s ease-in-out 0s;
            box-shadow: inset 0 0 20px 20px transparent !important;
          }
        `}
      </style>
      <div className="relative location-input">
      {/* Inline Address Builder */}
      <div className="space-y-3">
        {/* Location Selection */}
        <div className="relative mt-8">
          <input
            ref={inputRef}
            type="text"
            value={getLocationDisplay() || value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onClick={handleInputClick}
            placeholder=""
            className={`peer w-full px-0 pt-5 pb-2 pr-20 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition text-white ${
              error ? 'border-red-400' : 'border-gray-300'
            }`}
            style={{ backgroundColor: 'transparent' }}
          />
          <label
            className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${
              (getLocationDisplay() || value)
                ? '-top-2 text-xs md:text-sm text-white/70 font-bold'
                : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm md:peer-placeholder-shown:text-base peer-placeholder-shown:text-white'
            } peer-focus:-top-2 peer-focus:text-xs md:peer-focus:text-sm peer-focus:text-white/70 peer-focus:font-bold`}
          >
            {label}
          </label>
          
          <div className="absolute inset-y-0 right-0 flex items-center pr-0 space-x-1">
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

        {/* Address Input - Show when location is selected OR when value contains complete address */}
        {shouldShowAddressInput && (
          <div className="relative mt-8">
            <input
              type="text"
              value={userAddress}
              onChange={handleAddressChange}
              onBlur={() => {
                // Reset editing flag after a short delay to allow useEffect to extract if needed
                setTimeout(() => setIsEditingAddress(false), 100);
              }}
              onKeyDown={handleAddressKeyDown}
              placeholder=""
              className="peer w-full px-0 pt-10 pb-2 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition text-white border-gray-300"
              style={{ backgroundColor: 'transparent' }}
            />
            <label
              className={`absolute left-0 text-white bg-transparent transition-all duration-200 ${
                userAddress
                  ? 'top-3 text-xs md:text-sm text-white/70 font-bold'
                  : 'peer-placeholder-shown:top-10 peer-placeholder-shown:text-sm md:peer-placeholder-shown:text-base peer-placeholder-shown:text-white'
              } peer-focus:top-3 peer-focus:text-xs md:peer-focus:text-sm peer-focus:text-white/70 peer-focus:font-bold`}
            >
              {addressLabel}
            </label>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          onMouseDown={handleDropdownMouseDown}
          className="absolute z-10 w-full mt-1 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
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
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
      </div>
    </>
  );
};

export default LocationAutocomplete;