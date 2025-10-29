import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { request, gql } from 'graphql-request';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import API_CONFIG from '../config/api';

const API_URL = API_CONFIG.API_URL;

const CREATE_DRIVER_REPORT = gql`
  mutation CreateDriverReport($input: CreateDriverReportInput!) {
    createDriverReport(input: $input) {
      success
      message
      report {
        id
        title
        description
        reportType
        status
        createdAt
      }
    }
  }
`;

const GET_DRIVER_PROFILE = gql`
  query GetDriverProfile($driverId: ID!) {
    getDriver(driverId: $driverId) {
      success
      message
      driver {
        driverId
        firstName
        middleName
        lastName
        email
        contactNumber
        address
        licenseNumber
        licensePictureURL
        vehiclePlateNumber
        vehicleModel
        vehicleType
        vehicleYear
        vehiclePhotoURL
        orCrPictureURL
        profilePicture
      }
    }
  }
`;

interface ReportIssueModalProps {
  visible: boolean;
  onClose: () => void;
}

const categories = [
  { value: 'BUG', label: 'Bug / Technical Issue', icon: 'bug-outline' },
  { value: 'PAYMENT', label: 'Payment Issue', icon: 'card-outline' },
  { value: 'ACCOUNT', label: 'Account Issue', icon: 'person-outline' },
  { value: 'VEHICLE_ISSUE', label: 'Vehicle Issue', icon: 'car-outline' },
  { value: 'MATERIAL_ISSUE', label: 'Material Issue', icon: 'cube-outline' },
  { value: 'APP_ISSUE', label: 'App Issue', icon: 'phone-portrait-outline' },
  { value: 'REQUEST_ACCOUNT_CLOSURE', label: 'Request Account Closure', icon: 'trash-outline' },
  { value: 'UPDATE_PROFILE_DETAILS', label: 'Update Profile Details', icon: 'person-circle-outline' },
  { value: 'OTHER', label: 'Other', icon: 'help-circle-outline' },
];

interface ProfileField {
  key: string;
  label: string;
  currentValue: string;
  requiresFile?: boolean;
  fileType?: 'image' | 'pdf' | 'both';
}

export default function ReportIssueModal({ visible, onClose }: ReportIssueModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; category?: string }>({});
  
  // Profile update specific states
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { uri: string; type: string; name: string }>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Load driver profile when modal opens and category is UPDATE_PROFILE_DETAILS
  useEffect(() => {
    if (visible && formData.category === 'UPDATE_PROFILE_DETAILS') {
      loadDriverProfile();
    }
  }, [visible, formData.category]);

  const loadDriverProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const driverId = await AsyncStorage.getItem('driverId');

      if (!token || !driverId) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const result = await request(
        API_URL,
        GET_DRIVER_PROFILE,
        { driverId },
        { Authorization: `Bearer ${token}` }
      );

      if (result.getDriver?.success && result.getDriver.driver) {
        setDriverProfile(result.getDriver.driver);
      }
    } catch (error: any) {
      console.error('Error loading driver profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    }
  };

  const profileFields: ProfileField[] = driverProfile ? [
    { key: 'firstName', label: 'First Name', currentValue: driverProfile.firstName || '' },
    { key: 'middleName', label: 'Middle Name', currentValue: driverProfile.middleName || '' },
    { key: 'lastName', label: 'Last Name', currentValue: driverProfile.lastName || '' },
    { key: 'email', label: 'Email', currentValue: driverProfile.email || '' },
    { key: 'contactNumber', label: 'Contact Number', currentValue: driverProfile.contactNumber || '' },
    { key: 'address', label: 'Address', currentValue: driverProfile.address || '' },
    { key: 'licenseNumber', label: 'License Number', currentValue: driverProfile.licenseNumber || '', requiresFile: true, fileType: 'both' },
    { key: 'vehiclePlateNumber', label: 'Vehicle Plate Number', currentValue: driverProfile.vehiclePlateNumber || '' },
    { key: 'vehicleModel', label: 'Vehicle Model', currentValue: driverProfile.vehicleModel || '' },
    { key: 'vehicleType', label: 'Vehicle Type', currentValue: driverProfile.vehicleType || '' },
    { key: 'vehicleYear', label: 'Vehicle Year', currentValue: String(driverProfile.vehicleYear || '') },
    { key: 'vehiclePhoto', label: 'Vehicle Photo', currentValue: 'Upload new photo', requiresFile: true, fileType: 'image' },
    { key: 'orCrDocument', label: 'OR/CR Document', currentValue: 'Upload new document', requiresFile: true, fileType: 'both' },
    { key: 'profilePicture', label: 'Profile Picture', currentValue: 'Upload new photo', requiresFile: true, fileType: 'image' },
  ] : [];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFieldSelection = (fieldKey: string) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldKey)) {
        // Remove field
        const newFields = prev.filter(k => k !== fieldKey);
        const newValues = { ...fieldValues };
        delete newValues[fieldKey];
        setFieldValues(newValues);
        
        const newFiles = { ...uploadedFiles };
        delete newFiles[fieldKey];
        setUploadedFiles(newFiles);
        
        return newFields;
      } else {
        // Add field
        return [...prev, fieldKey];
      }
    });
  };

  const handleFieldValueChange = (fieldKey: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  // Helper function to check if submit button should be enabled
  const isSubmitEnabled = () => {
    if (isSubmitting) return false;
    if (!formData.category) return false;

    if (formData.category === 'UPDATE_PROFILE_DETAILS') {
      // Must have at least one field selected
      if (selectedFields.length === 0) return false;

      // All selected fields must have values or files
      for (const fieldKey of selectedFields) {
        const field = profileFields.find(f => f.key === fieldKey);
        if (!field) continue;

        if (field.requiresFile) {
          if (!uploadedFiles[fieldKey]) return false;
        } else {
          if (!fieldValues[fieldKey]?.trim()) return false;
        }
      }

      return true;
    } else {
      // Regular categories need title and description
      return formData.title.trim().length > 0 && formData.description.trim().length > 0;
    }
  };

  const pickFile = async (fieldKey: string, fileType: 'image' | 'pdf' | 'both') => {
    try {
      setUploadingField(fieldKey);

      let result: any;

      if (fileType === 'image') {
        // Pick image
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant camera roll permissions');
          setUploadingField(null);
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        // Pick document (PDF or image)
        result = await DocumentPicker.getDocumentAsync({
          type: fileType === 'pdf' ? 'application/pdf' : ['application/pdf', 'image/*'],
          copyToCacheDirectory: true,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setUploadedFiles(prev => ({
          ...prev,
          [fieldKey]: {
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            name: file.name || `${fieldKey}_${Date.now()}`,
          },
        }));
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    } finally {
      setUploadingField(null);
    }
  };

  const uploadFileToFirebase = async (file: { uri: string; type: string; name: string }): Promise<string> => {
    try {
      const token = await AsyncStorage.getItem('token');
      const driverId = await AsyncStorage.getItem('driverId');

      if (!token) {
        throw new Error('Authentication required');
      }

      // Get file as blob
      const fileUri = file.uri;
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Request signed URL from server
      const signedUrlResponse = await fetch(`${API_CONFIG.BASE_URL}/upload/generate-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: driverId || 'unknown',
          fileName: file.name,
          contentType: file.type,
          folder: 'drivers/profile-update-requests',
          metadata: { purpose: 'profileUpdateRequest' }
        })
      });

      const signedUrlData = await signedUrlResponse.json();
      if (!signedUrlData.success) {
        throw new Error(signedUrlData.error || 'Failed to get upload URL');
      }

      const { signedUrl, publicUrl } = signedUrlData.data;

      // Upload file to Firebase Storage
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-goog-meta-original-filename': file.name,
          'x-goog-meta-purpose': 'profileUpdateRequest',
          'x-goog-meta-uploaded-by': driverId || 'unknown'
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const validateForm = () => {
    const newErrors: { title?: string; description?: string; category?: string } = {};

    if (!formData.category) {
      newErrors.category = 'Please select a category';
      setErrors(newErrors);
      return false;
    }

    // Special validation for UPDATE_PROFILE_DETAILS
    if (formData.category === 'UPDATE_PROFILE_DETAILS') {
      if (selectedFields.length === 0) {
        Alert.alert('Validation Error', 'Please select at least one field to update');
        return false;
      }

      // Check if all selected fields have values or files
      for (const fieldKey of selectedFields) {
        const field = profileFields.find(f => f.key === fieldKey);
        if (!field) continue;

        if (field.requiresFile) {
          if (!uploadedFiles[fieldKey]) {
            Alert.alert('Validation Error', `Please upload a file for ${field.label}`);
            return false;
          }
        } else {
          if (!fieldValues[fieldKey]?.trim()) {
            Alert.alert('Validation Error', `Please enter a new value for ${field.label}`);
            return false;
          }
        }
      }
    } else {
      // Regular validation for other categories
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required';
      } else if (formData.title.length > 200) {
        newErrors.title = 'Title must be 200 characters or less';
      }

      if (!formData.description.trim()) {
        newErrors.description = 'Description is required';
      } else if (formData.description.length > 2000) {
        newErrors.description = 'Description must be 2000 characters or less';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      let attachments: string[] = [];
      let title = formData.title.trim();
      let description = formData.description.trim();

      // Special handling for UPDATE_PROFILE_DETAILS
      if (formData.category === 'UPDATE_PROFILE_DETAILS') {
        // Upload all files first
        for (const fieldKey of selectedFields) {
          if (uploadedFiles[fieldKey]) {
            try {
              const publicUrl = await uploadFileToFirebase(uploadedFiles[fieldKey]);
              attachments.push(publicUrl);
            } catch (error: any) {
              Alert.alert('Upload Error', `Failed to upload file for ${fieldKey}: ${error.message}`);
              setIsSubmitting(false);
              return;
            }
          }
        }

        // Build structured description
        const requestData = {
          requestedFields: selectedFields,
          changes: selectedFields.map(fieldKey => {
            const field = profileFields.find(f => f.key === fieldKey);
            return {
              fieldKey,
              fieldLabel: field?.label || fieldKey,
              currentValue: field?.currentValue || '',
              newValue: fieldValues[fieldKey] || 'See attachment',
              hasAttachment: !!uploadedFiles[fieldKey],
            };
          }),
        };

        title = 'Profile Update Request';
        description = JSON.stringify(requestData);
      }

      const result = await request(
        API_URL,
        CREATE_DRIVER_REPORT,
        {
          input: {
            title,
            description,
            reportType: formData.category,
            attachments,
          },
        },
        {
          Authorization: `Bearer ${token}`,
        }
      );

      if (result.createDriverReport?.success) {
        Alert.alert(
          'Success',
          formData.category === 'UPDATE_PROFILE_DETAILS'
            ? 'Your profile update request has been submitted. The admin will review it shortly.'
            : 'Your report has been submitted successfully. Our team will review it shortly.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setFormData({
                  title: '',
                  description: '',
                  category: '',
                });
                setSelectedFields([]);
                setFieldValues({});
                setUploadedFiles({});
                setErrors({});
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.createDriverReport?.message || 'Failed to submit report');
      }
    } catch (error: any) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (formData.title || formData.description || formData.category || selectedFields.length > 0) {
      Alert.alert(
        'Discard Report?',
        'Are you sure you want to discard this report?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setFormData({ title: '', description: '', category: '' });
              setSelectedFields([]);
              setFieldValues({});
              setUploadedFiles({});
              setErrors({});
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Category <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryButton,
                    formData.category === category.value && styles.categoryButtonSelected,
                  ]}
                  onPress={() => handleInputChange('category', category.value)}
                  disabled={isSubmitting}
                >
                  <Ionicons
                    name={category.icon as any}
                    size={24}
                    color={formData.category === category.value ? '#fff' : '#3b82f6'}
                  />
                  <Text
                    style={[
                      styles.categoryButtonText,
                      formData.category === category.value && styles.categoryButtonTextSelected,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          {/* Conditional Rendering based on Category */}
          {formData.category === 'UPDATE_PROFILE_DETAILS' ? (
            <>
              {/* Profile Update Fields */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Select Fields to Update <Text style={styles.required}>*</Text>
                </Text>
                <Text style={styles.helperText}>
                  Choose the fields you want to update and provide the new values.
                </Text>

                {profileFields.map((field) => (
                  <View key={field.key} style={styles.fieldContainer}>
                    <TouchableOpacity
                      style={styles.fieldCheckbox}
                      onPress={() => handleFieldSelection(field.key)}
                      disabled={isSubmitting}
                    >
                      <Ionicons
                        name={selectedFields.includes(field.key) ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={selectedFields.includes(field.key) ? '#3b82f6' : '#9ca3af'}
                      />
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                    </TouchableOpacity>

                    {selectedFields.includes(field.key) && (
                      <View style={styles.fieldInputContainer}>
                        <Text style={styles.currentValueLabel}>Current: {field.currentValue}</Text>
                        
                        {field.requiresFile ? (
                          <View style={styles.fileUploadContainer}>
                            <TouchableOpacity
                              style={[styles.fileUploadButton, uploadedFiles[field.key] && styles.fileUploadButtonSuccess]}
                              onPress={() => pickFile(field.key, field.fileType || 'both')}
                              disabled={uploadingField === field.key || isSubmitting}
                            >
                              {uploadingField === field.key ? (
                                <ActivityIndicator size="small" color="#3b82f6" />
                              ) : (
                                <>
                                  <Ionicons
                                    name={uploadedFiles[field.key] ? 'checkmark-circle' : 'cloud-upload-outline'}
                                    size={20}
                                    color={uploadedFiles[field.key] ? '#22c55e' : '#3b82f6'}
                                  />
                                  <Text style={[styles.fileUploadButtonText, uploadedFiles[field.key] && styles.fileUploadButtonTextSuccess]}>
                                    {uploadedFiles[field.key] ? 'File Uploaded' : `Upload ${field.fileType === 'image' ? 'Image' : 'File'}`}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                            {uploadedFiles[field.key] && (
                              <Text style={styles.fileName} numberOfLines={1}>
                                {uploadedFiles[field.key].name}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <TextInput
                            style={styles.fieldInput}
                            placeholder={`Enter new ${field.label.toLowerCase()}`}
                            value={fieldValues[field.key] || ''}
                            onChangeText={(value) => handleFieldValueChange(field.key, value)}
                            editable={!isSubmitting}
                            multiline={field.key === 'address'}
                            numberOfLines={field.key === 'address' ? 3 : 1}
                          />
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Title Input (for non-profile-update categories) */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Title <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder="Brief description of the issue"
                  value={formData.title}
                  onChangeText={(value) => handleInputChange('title', value)}
                  maxLength={200}
                  editable={!isSubmitting}
                />
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
                <Text style={styles.characterCount}>{formData.title.length}/200</Text>
              </View>

              {/* Description Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>
                  Description <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textArea, errors.description && styles.inputError]}
                  placeholder="Please provide detailed information about the issue..."
                  value={formData.description}
                  onChangeText={(value) => handleInputChange('description', value)}
                  maxLength={2000}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
                {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
                <Text style={styles.characterCount}>{formData.description.length}/2000</Text>
              </View>
            </>
          )}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text style={styles.infoText}>
              {formData.category === 'UPDATE_PROFILE_DETAILS'
                ? 'Your profile update request will be reviewed by an admin. You will be notified once your request is processed.'
                : 'Our support team will review your report and respond as soon as possible. You can check the status and admin responses in the Reports tab.'}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              !isSubmitEnabled() && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isSubmitEnabled()}
            activeOpacity={!isSubmitEnabled() ? 1 : 0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={!isSubmitEnabled() ? '#9ca3af' : '#fff'} 
                />
                <Text style={[
                  styles.submitButtonText,
                  !isSubmitEnabled() && styles.submitButtonTextDisabled
                ]}>
                  Submit Report
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 150,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  categoryButtonSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  fieldContainer: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fieldCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  fieldInputContainer: {
    marginTop: 12,
    paddingLeft: 36,
  },
  currentValueLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  fieldInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#1f2937',
  },
  fileUploadContainer: {
    gap: 8,
  },
  fileUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  fileUploadButtonSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  fileUploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
  fileUploadButtonTextSuccess: {
    color: '#22c55e',
  },
  fileName: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#e5e7eb',
    opacity: 1,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  submitButtonTextDisabled: {
    color: '#9ca3af',
  },
  bottomSpacing: {
    height: 40,
  },
});
