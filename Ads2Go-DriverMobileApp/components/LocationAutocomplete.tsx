import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

// Convert JSON data to flat array for easier searching
const locationData: LocationOption[] = [];

philippinesData.regions.forEach((region: any) => {
  // Add region
  locationData.push({
    id: region.id,
    name: region.name,
    type: 'region'
  });

  // Add cities
  region.cities.forEach((city: any) => {
    locationData.push({
      id: city.id,
      name: city.name,
      type: 'city',
      parentId: region.id,
      postalCode: city.postalCode
    });

    // Add barangays
    city.barangays.forEach((barangay: any) => {
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
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [isLocationSelected, setIsLocationSelected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<LocationOption[]>([]);

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
    if (value) {
      const locationPart = getLocationPart();
      
      // If we have a complete location selected and the value contains it
      if (locationPart && value.includes(locationPart)) {
        // Extract user address (house number and street) - part before the location
        const addressPart = value.replace(locationPart, '').replace(/,\s*$/, '');
        if (addressPart !== userAddress) {
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
              const addressPart = value.replace(extractedLocationPart, '').replace(/,\s*$/, '');
              if (addressPart !== userAddress) {
                setUserAddress(addressPart);
              }
            }
          }
        }
      }
    }
  }, [value]);

  // Filter options based on hierarchy
  const filterOptions = () => {
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

    // If no selections, show regions
    return locationData.filter(item => item.type === 'region');
  };

  useEffect(() => {
    const filtered = filterOptions();
    setFilteredOptions(filtered);
  }, [selectedRegion, selectedCity]);

  const updateMainValue = (customAddress?: string) => {
    if (selectedRegion && selectedCity && selectedBarangay) {
      const locationPart = getLocationPart();
      const addressToUse = customAddress ?? userAddress;
      const fullAddress = addressToUse ? `${addressToUse}, ${locationPart}` : locationPart;
      onChange(fullAddress);
    }
  };

  const handleOptionSelect = (option: LocationOption) => {
    if (option.type === 'region') {
      setSelectedRegion(option.id);
      setSelectedCity(null);
      setSelectedBarangay(null);
      setIsLocationSelected(false);
      setUserAddress('');
    } else if (option.type === 'city') {
      setSelectedCity(option.id);
      setSelectedBarangay(null);
    } else if (option.type === 'barangay') {
      setSelectedBarangay(option.id);
      setIsLocationSelected(true);
      setIsModalVisible(false);
      // Update the main value with current user address + location
      setTimeout(() => updateMainValue(), 100);
    }
  };

  const clearSelection = () => {
    setSelectedRegion(null);
    setSelectedCity(null);
    setSelectedBarangay(null);
    setIsLocationSelected(false);
    setUserAddress('');
    onChange('');
  };

  const getLocationDisplay = () => {
    if (selectedRegion && selectedCity && selectedBarangay) {
      return getLocationPart();
    } else if (selectedRegion && selectedCity) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      const city = locationData.find(c => c.id === selectedCity);
      const cityName = city?.name;
      return `${cityName}, ${regionName}`;
    } else if (selectedRegion) {
      const regionName = locationData.find(r => r.id === selectedRegion)?.name;
      return regionName;
    }
    return '';
  };

  const handleAddressChange = (newAddress: string) => {
    setUserAddress(newAddress);
    
    if (selectedRegion && selectedCity && selectedBarangay) {
      const locationPart = getLocationPart();
      
      if (newAddress.length === 0) {
        onChange(locationPart);
      } else {
        onChange(`${newAddress}, ${locationPart}`);
      }
    } else {
      onChange(newAddress);
    }
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [];
    if (selectedRegion) {
      breadcrumbs.push(locationData.find(r => r.id === selectedRegion)?.name || '');
    }
    if (selectedCity) {
      breadcrumbs.push(locationData.find(c => c.id === selectedCity)?.name || '');
    }
    return breadcrumbs.join(' → ');
  };

  const goBackToRegion = () => {
    setSelectedCity(null);
    setSelectedBarangay(null);
  };

  const goBackToCity = () => {
    setSelectedBarangay(null);
  };

  const shouldShowAddressInput = selectedRegion && selectedCity && selectedBarangay;

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && (
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
      )}

      {/* Location Input */}
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => setIsModalVisible(true)}
      >
        <View style={styles.inputContent}>
          <Ionicons name="location-outline" size={20} color="#666" style={styles.icon} />
          <Text style={[styles.inputText, !getLocationDisplay() && styles.placeholderText]}>
            {getLocationDisplay() || placeholder}
          </Text>
          {selectedRegion && (
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Address Input - Show when location is selected */}
      {shouldShowAddressInput && (
        <View style={styles.addressInputContainer}>
          <TextInput
            style={styles.addressInput}
            value={userAddress}
            onChangeText={handleAddressChange}
            placeholder="Enter your house number and street..."
            placeholderTextColor="#999"
            keyboardType="default"
            autoCapitalize="words"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>
      )}

      {/* Location Selection Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {selectedCity ? 'Barangay' : selectedRegion ? 'City' : 'Region'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Breadcrumb Navigation */}
            {(selectedRegion || selectedCity) && (
              <View style={styles.breadcrumbContainer}>
                <TouchableOpacity onPress={goBackToRegion} style={styles.breadcrumbButton}>
                  <Ionicons name="arrow-back" size={20} color="#1B5087" />
                  <Text style={styles.breadcrumbText}>{getBreadcrumbs()}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Options List */}
            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => handleOptionSelect(item)}
                >
                  <View style={styles.optionContent}>
                    <Text style={styles.optionName}>{item.name}</Text>
                    {item.postalCode && (
                      <Text style={styles.postalCode}>Postal: {item.postalCode}</Text>
                    )}
                  </View>
                  <Text style={styles.optionType}>{item.type}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No options available</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
    marginTop: 20,

  },
  required: {
    color: '#e74c3c',
  },
  inputContainer: {
    backgroundColor: '#fff',
    
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
  },
  placeholderText: {
    color: '#999',
  },
  clearButton: {
    padding: 5,
  },
  addressInputContainer: {
    marginTop: 10,
  },
  addressInput: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.75,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  breadcrumbContainer: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  breadcrumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#1B5087',
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  postalCode: {
    fontSize: 12,
    color: '#1B5087',
    marginTop: 4,
  },
  optionType: {
    fontSize: 12,
    color: '#999',
    textTransform: 'capitalize',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default LocationAutocomplete;

