//REGISTER

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
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import API_CONFIG from "../../config/api";
import { FontAwesome5, FontAwesome, AntDesign, Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type CreateDriverInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  contactNumber: string;
  password: string;
  address: string;
  licenseNumber: string;
  licensePicture: any;
  vehiclePlateNumber: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleYear: number;
  vehiclePhoto: any;
  orCrPicture: any;
  preferredMaterialType: string[];
  profilePicture?: any;
};

const RegisterForm = () => {
  const router = useRouter(); 

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
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState<number | undefined>(undefined);
  const [preferredMaterialType, setPreferredMaterialType] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState<any>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<any>(null);
  const [licensePhoto, setLicensePhoto] = useState<any>(null);
  const [orCrPhoto, setOrCrPhoto] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const steps = [
    'Personal Info',
    'Account Setup',
    'Vehicle Details',
    'Documents',
    'Review'
  ];

  const vehicleTypes = ['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E-TRIKE'];
  const materialTypes = ['LCD', 'BANNER', 'STICKER', 'HEADDRESS', 'POSTER'];

  const pickImage = async (setImage: React.Dispatch<React.SetStateAction<any>>) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access media library is required!');
        return;
      }
  
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
        base64: false,
        exif: false,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
      });
  
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        // Get the file extension from the URI
        const uriParts = asset.uri.split('.');
        const fileExtension = uriParts.length > 1 ? uriParts[uriParts.length - 1].toLowerCase() : 'jpg';
        
        // Map file extension to MIME type with additional iOS formats
        const mimeTypeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'webp': 'image/webp',
          'heic': 'image/jpeg',
          'heif': 'image/jpeg'
        };
        
        // Determine the MIME type
        const mimeType = asset.mimeType || mimeTypeMap[fileExtension] || 'image/jpeg';
        
        // Create a proper file name with extension
        const fileName = asset.fileName || `file-${Date.now()}.${fileExtension}`;
  
        // Create a standard RN FormData file object
        const fileObj = {
          uri: asset.uri,
          name: fileName,
          type: mimeType,
          // keep size for local state if needed, but it won't be sent by FormData
          size: asset.fileSize || 0,
        } as any;
        
        setImage(fileObj);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };
  


  const validateStep = (step: number): boolean => {
    // Regex to check for names without numbers or symbols
    const nameRegex = /^[A-Za-z\s.'-]+$/;
    // Regex to check for exactly 10 digits
    const contactNumberRegex = /^\d{10}$/;

    switch (step) {
      case 0:
        if (!firstName.trim()) {
          Alert.alert('Validation Error', 'First Name is required.');
          return false;
        }
        if (!nameRegex.test(firstName.trim())) {
          Alert.alert('Validation Error', 'First Name cannot contain numbers or symbols.');
          return false;
        }
        if (!lastName.trim()) {
          Alert.alert('Validation Error', 'Last Name is required.');
          return false;
        }
        if (!nameRegex.test(lastName.trim())) {
          Alert.alert('Validation Error', 'Last Name cannot contain numbers or symbols.');
          return false;
        }
        return true;
      
      case 1:
        if (!email.trim()) {
          Alert.alert('Validation Error', 'Email Address is required.');
          return false;
        }
        if (!contactNumber.trim()) {
          Alert.alert('Validation Error', 'Contact Number is required.');
          return false;
        }
        if (!contactNumberRegex.test(contactNumber.trim())) {
          Alert.alert('Validation Error', 'Contact Number must be exactly 10 digits.');
          return false;
        }
        if (!password.trim()) {
          Alert.alert('Validation Error', 'Password is required.');
          return false;
        }
        if (password !== confirmPassword) {
          Alert.alert('Validation Error', 'Passwords do not match.');
          return false;
        }
        if (password.length < 6) {
          Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
          return false;
        }
        return true;
      
      case 2:
        if (!vehicleType) {
          Alert.alert('Validation Error', 'Vehicle Type is required.');
          return false;
        }
        if (!vehicleModel.trim()) {
          Alert.alert('Validation Error', 'Vehicle Model is required.');
          return false;
        }
        if (!vehicleYear) {
          Alert.alert('Validation Error', 'Vehicle Year is required.');
          return false;
        }
        if (!vehiclePlateNumber.trim()) {
          Alert.alert('Validation Error', 'Plate Number is required.');
          return false;
        }
        if (!licenseNumber.trim()) {
          Alert.alert('Validation Error', 'License Number is required.');
          return false;
        }
        if (preferredMaterialType.length === 0) {
          Alert.alert('Validation Error', 'Please select at least one Material Type.');
          return false;
        }
        return true;

      // Document validation is optional, so we don't block submission
      case 3:
        return true;

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
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) {
      Alert.alert('Validation Error', 'Please complete all required fields correctly before submitting.');
      return;
    }

    setLoading(true);

    try {
      const variables: any = {
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim(),
        password: password.trim(),
        address: address.trim(),
        licenseNumber: licenseNumber.trim(),
        vehiclePlateNumber: vehiclePlateNumber.trim(),
        vehicleType: vehicleType!.trim().toUpperCase(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: vehicleYear,
        preferredMaterialType: preferredMaterialType,
        profilePicture: null,
        vehiclePhoto: null,
        licensePicture: null,
        orCrPicture: null,
      };

      const operations = {
        query: `
          mutation CreateDriver(
            $firstName: String!,
            $middleName: String,
            $lastName: String!,
            $email: String!,
            $contactNumber: String!,
            $password: String!,
            $address: String!,
            $licenseNumber: String!,
            $vehiclePlateNumber: String!,
            $vehicleType: VehicleType!,
            $vehicleModel: String!,
            $vehicleYear: Int!,
            $preferredMaterialType: [MaterialTypeEnum!]!,
            $profilePicture: Upload,
            $vehiclePhoto: Upload,
            $licensePicture: Upload,
            $orCrPicture: Upload
          ) {
            createDriver(input: {
              firstName: $firstName,
              middleName: $middleName,
              lastName: $lastName,
              email: $email,
              contactNumber: $contactNumber,
              password: $password,
              address: $address,
              licenseNumber: $licenseNumber,
              vehiclePlateNumber: $vehiclePlateNumber,
              vehicleType: $vehicleType,
              vehicleModel: $vehicleModel,
              vehicleYear: $vehicleYear,
              preferredMaterialType: $preferredMaterialType,
              profilePicture: $profilePicture,
              vehiclePhoto: $vehiclePhoto,
              licensePicture: $licensePicture,
              orCrPicture: $orCrPicture
            }) {
              success
              message
              token
              driver {
                driverId
                email
              }
            }
          }
        `,
        variables,
      };

      const formData = new FormData();
      formData.append('operations', JSON.stringify(operations));

      const fileMap: { [key: string]: string[] } = {};
      const filesToUpload: { file: any; varName: string; fileKey: string }[] = [];
      let fileIndex = 0;

      [
        { file: profilePicture, varName: 'profilePicture' },
        { file: vehiclePhoto, varName: 'vehiclePhoto' },
        { file: licensePhoto, varName: 'licensePicture' },
        { file: orCrPhoto, varName: 'orCrPicture' },
      ].forEach(({ file, varName }) => {
        if (file) {
          fileIndex++;
          const fileKey = fileIndex.toString();
          fileMap[fileKey] = [`variables.${varName}`];
          filesToUpload.push({ file, varName, fileKey });
        }
      });

      formData.append('map', JSON.stringify(fileMap));

      for (const { file, fileKey } of filesToUpload) {
        // Append the file using the standard RN FormData format
        formData.append(fileKey, {
          uri: file.uri,
          name: file.name || `file-${Date.now()}.jpg`,
          type: file.type || 'image/jpeg',
        } as any);
      }

      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
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
                router.push({
                  pathname: '/(auth)/emailVerification',
                  params: {
                    email: email.trim(),
                    driverId: result.data.createDriver.driver?.driverId,
                    token: result.data.createDriver.token,
                    firstName: firstName.trim(),
                  },
                });
              },
            },
          ]
        );
      } else {
        const errorMessage = result.data?.createDriver.message || result.errors?.[0]?.message || 'Registration failed';
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
        <React.Fragment key={index}>
          <TouchableOpacity 
            style={[styles.stepCircle, currentStep >= index && styles.stepCircleActive]}
            onPress={() => setCurrentStep(index)}
            disabled={currentStep < index}
          >
            <Text style={[styles.stepNumber, currentStep >= index && styles.stepNumberActive]}>
              {index + 1}
            </Text>
          </TouchableOpacity>
          {index < steps.length - 1 && <View style={[styles.stepLine, currentStep >= index && styles.stepLineActive]} />}
        </React.Fragment>
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
      togglePassword?: () => void;
      showPassword?: boolean;
      isContactNumber?: boolean;
    }
  ) => {
    const isPasswordInput = options?.secureTextEntry !== undefined;
    const isContactNumberInput = options?.isContactNumber;
    
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>
          {label} {options?.required && <Text style={styles.required}>*</Text>}
        </Text>
        <View style={isPasswordInput ? styles.passwordContainer : isContactNumberInput ? styles.mobileInputGroup : null}>
          {isContactNumberInput && (
            <View style={styles.countryCodeContainer}>
              <Text style={styles.countryText}>🇵🇭</Text>
              <Text style={styles.countryCodeText}>+63</Text>
            </View>
          )}
          <TextInput
            style={[
              styles.input, 
              options?.multiline && styles.multilineInput,
              isPasswordInput && styles.passwordInput,
              isContactNumberInput && styles.mobileInput
            ]}
            value={value}
            onChangeText={(text) => {
              if (isContactNumberInput) {
                // Regex to allow only digits and limit to 10 characters
                const cleanedText = text.replace(/[^0-9]/g, '');
                onChangeText(cleanedText.slice(0, 10));
              } else {
                onChangeText(text);
              }
            }}
            placeholder={options?.placeholder || `Enter ${label.toLowerCase()}`}
            keyboardType={options?.keyboardType || 'default'}
            secureTextEntry={options?.secureTextEntry}
            multiline={options?.multiline || false}
            autoCapitalize={options?.autoCapitalize || 'words'}
            placeholderTextColor="#999"
          />
          {isPasswordInput && (
            <TouchableOpacity onPress={options?.togglePassword} style={styles.passwordToggle}>
              <Ionicons
                name={options?.showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>Let's start with your basic information</Text>
            
            {renderInput('First Name', firstName, setFirstName, { required: true, placeholder: 'Enter First Name' })}
            {renderInput('Middle Name', middleName, setMiddleName, { placeholder: 'Optional' })}
            {renderInput('Last Name', lastName, setLastName, { required: true, placeholder: 'Enter Last Name' })}
            {renderInput('Address', address, setAddress, { 
              multiline: true, 
              placeholder: 'Your complete address (optional)' 
            })}

            <View style={styles.formButtonContainer}>
              {currentStep > 0 && (
                  <TouchableOpacity
                      style={[styles.button, styles.backButton]}
                      onPress={prevStep}
                  >
                      <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
              )}
              <TouchableOpacity
                  style={[
                      styles.button,
                      styles.nextButton,
                      currentStep === 0 && styles.singleButton
                  ]}
                  onPress={nextStep}
              >
                  <Text style={styles.nextButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>

            <View>
              <Text style={styles.socialSeparator}>or Register with</Text>
              <View style={styles.socialButtonsContainer}>
                <TouchableOpacity style={styles.socialButton}>
                  <Ionicons name="logo-facebook" size={22} color="#1877F2" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                  <Ionicons name="logo-google" size={22} color="#DB4437" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton}>
                  <Ionicons name="logo-apple" size={22} color="#000" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkBold}>Log in</Text></Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 1:
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
              keyboardType: 'number-pad',
              required: true, 
              isContactNumber: true 
            })}
            {renderInput('Password', password, setPassword, {
              secureTextEntry: !showPassword,
              placeholder: 'At least 6 characters',
              required: true,
              togglePassword: () => setShowPassword(!showPassword),
              showPassword: showPassword
            })}
            {renderInput('Confirm Password', confirmPassword, setConfirmPassword, {
              secureTextEntry: !showConfirmPassword,
              placeholder: 'Re-enter your password',
              required: true,
              togglePassword: () => setShowConfirmPassword(!showConfirmPassword),
              showPassword: showConfirmPassword
            })}

            <View style={styles.formButtonContainer}>
              {currentStep > 0 && (
                  <TouchableOpacity
                      style={[styles.button, styles.backButton]}
                      onPress={prevStep}
                  >
                      <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
              )}
              <TouchableOpacity
                  style={[
                      styles.button,
                      styles.nextButton
                  ]}
                  onPress={nextStep}
              >
                  <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Vehicle Information</Text>
            <Text style={styles.stepDescription}>Tell us about your vehicle</Text>
            {renderSelectButton('Vehicle Type', vehicleTypes, vehicleType ? [vehicleType] : [], (values) => setVehicleType(values[0] || null), false)}
            {renderInput('Vehicle Model', vehicleModel, setVehicleModel, { required: true, placeholder: 'e.g., Toyota Vios, Honda Click' })}
            {renderInput('Vehicle Year', vehicleYear?.toString() || '', (text) => { const year = parseInt(text); setVehicleYear(isNaN(year) ? undefined : year); }, { keyboardType: 'numeric', required: true })}
            {renderInput('Plate Number', vehiclePlateNumber, setVehiclePlateNumber, { autoCapitalize: 'characters', required: true, placeholder: 'ABC-1234' })}
            {renderInput('License Number', licenseNumber, setLicenseNumber, { autoCapitalize: 'characters', required: true, placeholder: 'Your driver\'s license number' })}
            {renderSelectButton('Preferred Material Types', materialTypes, preferredMaterialType, setPreferredMaterialType, true)}
            <View style={styles.formButtonContainer}>
              {currentStep > 0 && (
                <TouchableOpacity style={[styles.button, styles.backButton]} onPress={prevStep} >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[ styles.button, styles.nextButton ]} onPress={nextStep} >
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Upload Documents</Text>
            <Text style={styles.stepDescription}>Upload your photos and documents (optional but recommended)</Text>
            
            {renderImagePicker('Profile Picture', profilePicture, () => pickImage(setProfilePicture))}
            {renderImagePicker('Vehicle Photo', vehiclePhoto, () => pickImage(setVehiclePhoto), true)}
            {renderImagePicker('License Photo', licensePhoto, () => pickImage(setLicensePhoto), true)}
            {renderImagePicker('OR/CR Photo', orCrPhoto, () => pickImage(setOrCrPhoto), true)}

            <View style={styles.formButtonContainer}>
                {currentStep > 0 && (
                    <TouchableOpacity
                        style={[styles.button, styles.backButton]}
                        onPress={prevStep}
                    >
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.nextButton
                    ]}
                    onPress={nextStep}
                >
                    <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
            </View>
          </View>
        );

      case 4:
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

            <View style={styles.formButtonContainer}>
              {currentStep > 0 && (
                  <TouchableOpacity
                      style={[styles.button, styles.backButton]}
                      onPress={prevStep}
                  >
                      <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
              )}
              <TouchableOpacity
                  style={[
                      styles.button,
                      styles.nextButton
                  ]}
                  onPress={handleRegister}
                  disabled={loading}
              >
                  <Text style={styles.nextButtonText}>
                      {loading ? 'Registering...' : 'Complete Registration'}
                  </Text>
              </TouchableOpacity>
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
        <Text style={styles.logo}>✨</Text>
        <Text style={styles.title}>Ads2go</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, styles.tabInactive]}
            onPress={() => router.push('/(auth)/login')} 
          >
            <Text style={styles.tabTextInactive}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabTextActive}>Register</Text>
          </TouchableOpacity>
        </View>
        {renderProgressBar()}
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {renderStepContent()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center", padding: 20 },
  header: {
    backgroundColor: '#fff',
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  logo: { fontSize: 30 },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d8d8d8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#1B5087',
  },
  stepLine: {
    height: 2,
    width: 25,
    backgroundColor: '#d8d8d8',
    marginHorizontal: 5,
  },
  stepLineActive: {
    backgroundColor: '#1B5087',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  stepNumberActive: {
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 5,
    width: '100%',
    marginTop: 15,
    marginBottom: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabInactive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  tabTextActive: {
    color: '#1B5087',
    fontWeight: 'bold',
  },
  tabTextInactive: {
    color: '#999',
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  stepContent: {
    paddingVertical: 20,
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#2c3e50',
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    marginBottom: 0,
  },
  passwordToggle: {
    padding: 5,
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
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
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
    borderColor: '#fff',
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
  formButtonContainer: {
    flexDirection: 'row',
    paddingTop: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleButton: {
    marginHorizontal: 0,
    marginLeft: 0,
  },
  backButton: {
    backgroundColor: '#fff',
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
    backgroundColor: '#1B5087',
    marginLeft: 10,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  socialSeparator: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: "row", 
    justifyContent: "center", 
    gap: 15
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  loginLink: {
    textAlign: 'center',
    fontSize: 14,
    color: '#555',
    marginTop: 20,
  },
  loginLinkBold: {
    fontWeight: 'bold',
    color: '#1B5087',
  },
  mobileInputGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    overflow: 'hidden',
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    backgroundColor: '#f8f8f8',
    borderRightWidth: 1,
    borderRightColor: '#e1e5e9',
  },
  countryText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#2c3e50',
  },
  countryCodeText: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  mobileInput: {
    flex: 1,
    borderWidth: 0,
    marginBottom: 0,
    padding: 15,
    fontSize: 16,
  },
});

export default RegisterForm;