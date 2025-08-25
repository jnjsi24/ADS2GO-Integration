import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  Image, 
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import API_CONFIG from "../../config/api";

// Define your navigation stack params
type RootStackParamList = {
  '(auth)/emailVerification': {
    email: string;
    driverId: string;
    token: string;
    firstName: string;
  };
  Login: undefined;
  Register: undefined;
};

type NavigationProps = NavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

type CreateDriverInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  contactNumber: string;
  password: string;
  address?: string;
  licenseNumber?: string;
  licensePicture?: any;
  vehiclePlateNumber?: string;
  vehicleType: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehiclePhoto?: any;
  orCrPicture?: any;
  preferredMaterialType: string[];
  profilePicture?: any;
};

const RegisterForm = () => {
  const navigation = useNavigation<NavigationProps>();
  
  // Form state
  const [currentStep, setCurrentStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState<number | undefined>(undefined);
  const [preferredMaterialType, setPreferredMaterialType] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState<any>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<any>(null);
  const [licensePhoto, setLicensePhoto] = useState<any>(null);
  const [orCrPhoto, setOrCrPhoto] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const steps = [
    'Personal Info',
    'Account Setup',
    'Vehicle Details',
    'Documents',
    'Review'
  ];

  const vehicleTypes = ['CAR', 'MOTOR', 'BUS', 'JEEP', 'E_TRIKE'];
  const materialTypes = ['LCD', 'BANNER', 'STICKER', 'HEADDRESS', 'POSTER'];

  const pickImage = async (setImage: React.Dispatch<React.SetStateAction<any>>) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access media library is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImage({
          uri: asset.uri,
          type: 'image/jpeg',
          name: `photo-${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Personal Info
        if (!firstName.trim() || !lastName.trim()) {
          Alert.alert('Error', 'Please fill in your first and last name');
          return false;
        }
        return true;
      
      case 1: // Account Setup
        if (!email.trim() || !contactNumber.trim() || !password.trim()) {
          Alert.alert('Error', 'Please fill in all required fields');
          return false;
        }
        if (password !== confirmPassword) {
          Alert.alert('Error', 'Passwords do not match');
          return false;
        }
        if (password.length < 6) {
          Alert.alert('Error', 'Password must be at least 6 characters long');
          return false;
        }
        return true;
      
      case 2: // Vehicle Details
        if (!vehicleType.trim()) {
          Alert.alert('Error', 'Please select a vehicle type');
          return false;
        }
        if (preferredMaterialType.length === 0) {
          Alert.alert('Error', 'Please select at least one preferred material type');
          return false;
        }
        return true;
      
      case 3: // Documents
        return true; // Optional documents
      
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRegister = async () => {
    if (!validateStep(2)) return; // Final validation

    setLoading(true);
    try {
      const formData = new FormData();

      const operations = {
        query: `
          mutation CreateDriver($input: DriverInput!) {
            createDriver(input: $input) {
              success
              message
              token
              driver {
                driverId
                email
                accountStatus
                firstName
                middleName
                lastName
                fullName
                preferredMaterialType
                isEmailVerified
              }
            }
          }
        `,
        variables: {
          input: {
            firstName: firstName.trim(),
            middleName: middleName.trim() || null,
            lastName: lastName.trim(),
            email: email.trim(),
            contactNumber: contactNumber.trim(),
            password: password.trim(),
            address: address.trim() || null,
            licenseNumber: licenseNumber.trim() || null,
            vehiclePlateNumber: vehiclePlateNumber.trim() || null,
            vehicleType: vehicleType.toUpperCase(),
            vehicleModel: vehicleModel.trim() || null,
            vehicleYear: vehicleYear || null,
            preferredMaterialType: preferredMaterialType.filter(type => type.trim()),
            profilePicture: null,
            vehiclePhoto: null,
            licensePicture: null,
            orCrPicture: null,
          },
        },
      };

      formData.append('operations', JSON.stringify(operations));

      const map: Record<string, string[]> = {};
      let fileIndex = 0;

      if (profilePicture) {
        map[fileIndex.toString()] = ['variables.input.profilePicture'];
        fileIndex++;
      }
      if (vehiclePhoto) {
        map[fileIndex.toString()] = ['variables.input.vehiclePhoto'];
        fileIndex++;
      }
      if (licensePhoto) {
        map[fileIndex.toString()] = ['variables.input.licensePicture'];
        fileIndex++;
      }
      if (orCrPhoto) {
        map[fileIndex.toString()] = ['variables.input.orCrPicture'];
        fileIndex++;
      }

      formData.append('map', JSON.stringify(map));

      fileIndex = 0;
      if (profilePicture) {
        formData.append(fileIndex.toString(), {
          uri: profilePicture.uri,
          type: profilePicture.type,
          name: profilePicture.name,
        } as any);
        fileIndex++;
      }
      if (vehiclePhoto) {
        formData.append(fileIndex.toString(), {
          uri: vehiclePhoto.uri,
          type: vehiclePhoto.type,
          name: vehiclePhoto.name,
        } as any);
        fileIndex++;
      }
      if (licensePhoto) {
        formData.append(fileIndex.toString(), {
          uri: licensePhoto.uri,
          type: licensePhoto.type,
          name: licensePhoto.name,
        } as any);
        fileIndex++;
      }
      if (orCrPhoto) {
        formData.append(fileIndex.toString(), {
          uri: orCrPhoto.uri,
          type: orCrPhoto.type,
          name: orCrPhoto.name,
        } as any);
        fileIndex++;
      }

      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
          'Apollo-Require-Preflight': 'true',
        },
        body: formData,
      });

      const result = await response.json();

      if (result.data?.createDriver.success) {
        Alert.alert(
          'Registration Successful!', 
          result.data.createDriver.message + '\n\nPlease check your email to verify your account.',
          [
            {
              text: 'Continue to Email Verification',
              onPress: () => {
                console.log('Driver created:', result.data.createDriver.driver);
                console.log('Token:', result.data.createDriver.token);
                
                // @ts-ignore - The route is correctly defined in the type
                navigation.navigate('(auth)/emailVerification' as any, {
                  email: email.trim(),
                  driverId: result.data.createDriver.driver?.driverId,
                  token: result.data.createDriver.token,
                  firstName: firstName.trim()
                });
              }
            }
          ]
        );
      } else {
        const errorMessage = result.data?.createDriver.message || 
                           result.errors?.[0]?.message || 
                           'Registration failed';
        Alert.alert('Error', errorMessage);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            index <= currentStep && styles.stepCircleActive
          ]}>
            <Text style={[
              styles.stepNumber,
              index <= currentStep && styles.stepNumberActive
            ]}>
              {index + 1}
            </Text>
          </View>
          <Text style={[
            styles.stepLabel,
            index === currentStep && styles.stepLabelActive
          ]}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    options?: {
      placeholder?: string;
      keyboardType?: any;
      secureTextEntry?: boolean;
      multiline?: boolean;
      autoCapitalize?: any;
      required?: boolean;
    }
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {options?.required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, options?.multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={options?.placeholder || `Enter ${label.toLowerCase()}`}
        keyboardType={options?.keyboardType || 'default'}
        secureTextEntry={options?.secureTextEntry || false}
        multiline={options?.multiline || false}
        autoCapitalize={options?.autoCapitalize || 'words'}
        placeholderTextColor="#999"
      />
    </View>
  );

  const renderSelectButton = (
    label: string,
    options: string[],
    selectedValues: string[],
    onSelect: (values: string[]) => void,
    multiple = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} <Text style={styles.required}>*</Text>
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => {
                if (multiple) {
                  if (isSelected) {
                    onSelect(selectedValues.filter(v => v !== option));
                  } else {
                    onSelect([...selectedValues, option]);
                  }
                } else {
                  onSelect([option]);
                }
              }}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderImagePicker = (
    label: string,
    image: any,
    onPress: () => void,
    required = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.imageButton, image && styles.imageButtonSelected]}
        onPress={onPress}
      >
        {image?.uri ? (
          <Image source={{ uri: image.uri }} style={styles.selectedImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageButtonText}>📷</Text>
            <Text style={styles.imageButtonSubtext}>Tap to select {label.toLowerCase()}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Personal Info
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Personal Information</Text>
            <Text style={styles.stepDescription}>Let's start with your basic information</Text>
            
            {renderInput('First Name', firstName, setFirstName, { required: true })}
            {renderInput('Middle Name', middleName, setMiddleName, { placeholder: 'Optional' })}
            {renderInput('Last Name', lastName, setLastName, { required: true })}
            {renderInput('Address', address, setAddress, { 
              multiline: true, 
              placeholder: 'Your complete address (optional)' 
            })}
          </View>
        );

      case 1: // Account Setup
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Account Setup</Text>
            <Text style={styles.stepDescription}>Create your login credentials</Text>
            
            {renderInput('Email Address', email, setEmail, {
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              required: true
            })}
            {renderInput('Contact Number', contactNumber, setContactNumber, {
              keyboardType: 'phone-pad',
              required: true
            })}
            {renderInput('Password', password, setPassword, {
              secureTextEntry: true,
              placeholder: 'At least 6 characters',
              required: true
            })}
            {renderInput('Confirm Password', confirmPassword, setConfirmPassword, {
              secureTextEntry: true,
              placeholder: 'Re-enter your password',
              required: true
            })}
          </View>
        );

      case 2: // Vehicle Details
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Vehicle Information</Text>
            <Text style={styles.stepDescription}>Tell us about your vehicle</Text>
            
            {renderSelectButton('Vehicle Type', vehicleTypes, [vehicleType], (values) => setVehicleType(values[0] || ''))}
            
            {renderInput('Vehicle Model', vehicleModel, setVehicleModel, {
              placeholder: 'e.g., Toyota Vios, Honda Click'
            })}
            {renderInput('Vehicle Year', vehicleYear?.toString() || '', (text) => {
              const year = parseInt(text);
              setVehicleYear(isNaN(year) ? undefined : year);
            }, { keyboardType: 'numeric' })}
            {renderInput('Plate Number', vehiclePlateNumber, setVehiclePlateNumber, {
              autoCapitalize: 'characters',
              placeholder: 'ABC-1234'
            })}
            {renderInput('License Number', licenseNumber, setLicenseNumber, {
              autoCapitalize: 'characters',
              placeholder: 'Your driver\'s license number'
            })}
            
            {renderSelectButton('Preferred Material Types', materialTypes, preferredMaterialType, setPreferredMaterialType, true)}
          </View>
        );

      case 3: // Documents
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Upload Documents</Text>
            <Text style={styles.stepDescription}>Upload your photos and documents (optional but recommended)</Text>
            
            {renderImagePicker('Profile Picture', profilePicture, () => pickImage(setProfilePicture))}
            {renderImagePicker('Vehicle Photo', vehiclePhoto, () => pickImage(setVehiclePhoto))}
            {renderImagePicker('License Photo', licensePhoto, () => pickImage(setLicensePhoto))}
            {renderImagePicker('OR/CR Photo', orCrPhoto, () => pickImage(setOrCrPhoto))}
          </View>
        );

      case 4: // Review
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review Your Information</Text>
            <Text style={styles.stepDescription}>Please review all details before submitting</Text>
            
            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Personal Information</Text>
              <Text style={styles.reviewItem}>Name: {firstName} {middleName} {lastName}</Text>
              <Text style={styles.reviewItem}>Email: {email}</Text>
              <Text style={styles.reviewItem}>Phone: {contactNumber}</Text>
              {address && <Text style={styles.reviewItem}>Address: {address}</Text>}
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Vehicle Information</Text>
              <Text style={styles.reviewItem}>Type: {vehicleType}</Text>
              {vehicleModel && <Text style={styles.reviewItem}>Model: {vehicleModel}</Text>}
              {vehicleYear && <Text style={styles.reviewItem}>Year: {vehicleYear}</Text>}
              {vehiclePlateNumber && <Text style={styles.reviewItem}>Plate: {vehiclePlateNumber}</Text>}
              {licenseNumber && <Text style={styles.reviewItem}>License: {licenseNumber}</Text>}
              <Text style={styles.reviewItem}>
                Materials: {preferredMaterialType.join(', ')}
              </Text>
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Uploaded Documents</Text>
              <Text style={styles.reviewItem}>Profile Picture: {profilePicture ? '✓' : '✗'}</Text>
              <Text style={styles.reviewItem}>Vehicle Photo: {vehiclePhoto ? '✓' : '✗'}</Text>
              <Text style={styles.reviewItem}>License Photo: {licensePhoto ? '✓' : '✗'}</Text>
              <Text style={styles.reviewItem}>OR/CR Photo: {orCrPhoto ? '✓' : '✗'}</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Driver Registration</Text>
        {renderProgressBar()}
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderStepContent()}
      </ScrollView>

      <View style={styles.buttonContainer}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.backButton]}
            onPress={prevStep}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.button,
            styles.nextButton,
            currentStep === 0 && styles.singleButton
          ]}
          onPress={currentStep === steps.length - 1 ? handleRegister : nextStep}
          disabled={loading}
        >
          <Text style={styles.nextButtonText}>
            {loading ? 'Registering...' : 
             currentStep === steps.length - 1 ? 'Complete Registration' : 
             'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#2c3e50',
    marginBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e1e5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  stepCircleActive: {
    backgroundColor: '#3498db',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 10,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#3498db',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  stepDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 25,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionScroll: {
    flexDirection: 'row',
  },
  optionButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  optionButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  optionText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
  },
  imageButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e1e5e9',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtonSelected: {
    borderColor: '#3498db',
    borderStyle: 'solid',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imageButtonText: {
    fontSize: 30,
    marginBottom: 5,
  },
  imageButtonSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  reviewSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  reviewItem: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
    lineHeight: 20,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleButton: {
    marginLeft: 0,
  },
  backButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#3498db',
    marginLeft: 10,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default RegisterForm;