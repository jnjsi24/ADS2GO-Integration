import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import API_CONFIG from "../../config/api";

type CreateDriverInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  contactNumber: string;
  password: string;
  address?: string;
  licenseNumber?: string;
  licensePicture?: any; // Changed from licensePictureURL
  vehiclePlateNumber?: string;
  vehicleType: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehiclePhoto?: any; // Changed from vehiclePhotoURL
  orCrPicture?: any; // Changed from orCrPictureURL
  preferredMaterialType: string[];
  profilePicture?: any;
};

const RegisterForm = () => {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
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
          name: `photo-${Date.now()}.jpg`, // Changed from fileName to name
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRegister = async () => {
    // Basic validation
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !contactNumber.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!vehicleType.trim()) {
      Alert.alert('Error', 'Please select a vehicle type');
      return;
    }

    if (preferredMaterialType.length === 0) {
      Alert.alert('Error', 'Please select at least one preferred material type');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();

      // GraphQL operation
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
            // Set upload fields to null initially - they'll be mapped via the map
            profilePicture: null,
            vehiclePhoto: null,
            licensePicture: null,
            orCrPicture: null,
          },
        },
      };

      formData.append('operations', JSON.stringify(operations));

      // Create file map for multipart uploads
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

      // Append files in the same order as the map
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
          'Apollo-Require-Preflight': 'true', // This bypasses CSRF protection
        },
        body: formData,
      });

      const result = await response.json();

      if (result.data?.createDriver.success) {
        Alert.alert(
          'Success', 
          result.data.createDriver.message + '\n\nPlease check your email to verify your account.',
          [
            {
              text: 'OK',
              onPress: () => {
                // You might want to navigate to email verification screen here
                console.log('Driver created:', result.data.createDriver.driver);
                console.log('Token:', result.data.createDriver.token);
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

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        Driver Registration
      </Text>

      {/* Required Fields */}
      <Text style={{ fontWeight: 'bold', color: 'red' }}>* Required Fields</Text>
      
      <Text>First Name *</Text>
      <TextInput 
        value={firstName} 
        onChangeText={setFirstName} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter first name"
      />
      
      <Text>Middle Name</Text>
      <TextInput 
        value={middleName} 
        onChangeText={setMiddleName} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter middle name (optional)"
      />
      
      <Text>Last Name *</Text>
      <TextInput 
        value={lastName} 
        onChangeText={setLastName} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter last name"
      />
      
      <Text>Email *</Text>
      <TextInput 
        value={email} 
        onChangeText={setEmail} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        keyboardType="email-address"
        placeholder="Enter email address"
        autoCapitalize="none"
      />
      
      <Text>Contact Number *</Text>
      <TextInput 
        value={contactNumber} 
        onChangeText={setContactNumber} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        keyboardType="phone-pad"
        placeholder="Enter contact number"
      />
      
      <Text>Password *</Text>
      <TextInput 
        value={password} 
        onChangeText={setPassword} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        secureTextEntry
        placeholder="Enter password (min 6 characters)"
      />
      
      <Text>Address</Text>
      <TextInput 
        value={address} 
        onChangeText={setAddress} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter address"
        multiline
      />
      
      <Text>License Number</Text>
      <TextInput 
        value={licenseNumber} 
        onChangeText={setLicenseNumber} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter license number"
        autoCapitalize="characters"
      />
      
      <Text>Vehicle Plate Number</Text>
      <TextInput 
        value={vehiclePlateNumber} 
        onChangeText={setVehiclePlateNumber} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter vehicle plate number"
        autoCapitalize="characters"
      />
      
      <Text>Vehicle Type * (CAR, MOTOR, BUS, JEEP, E_TRIKE)</Text>
      <TextInput 
        value={vehicleType} 
        onChangeText={setVehicleType} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter vehicle type"
        autoCapitalize="characters"
      />
      
      <Text>Vehicle Model</Text>
      <TextInput 
        value={vehicleModel} 
        onChangeText={setVehicleModel} 
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }} 
        placeholder="Enter vehicle model"
      />
      
      <Text>Vehicle Year</Text>
      <TextInput
        value={vehicleYear?.toString() || ''}
        onChangeText={text => {
          const year = parseInt(text);
          setVehicleYear(isNaN(year) ? undefined : year);
        }}
        style={{ borderWidth: 1, marginBottom: 8, padding: 8 }}
        keyboardType="numeric"
        placeholder="Enter vehicle year"
      />
      
      <Text>Preferred Material Types * (LCD, BANNER, STICKER, HEADDRESS, POSTER)</Text>
      <TextInput
        value={preferredMaterialType.join(', ')}
        onChangeText={text => {
          const types = text.split(',').map(item => item.trim().toUpperCase()).filter(Boolean);
          setPreferredMaterialType(types);
        }}
        style={{ borderWidth: 1, marginBottom: 16, padding: 8 }}
        placeholder="Enter types separated by commas"
        autoCapitalize="characters"
      />

      {/* Image Pickers */}
      {[
        { label: 'Profile Picture', image: profilePicture, setter: setProfilePicture },
        { label: 'Vehicle Photo', image: vehiclePhoto, setter: setVehiclePhoto },
        { label: 'License Photo', image: licensePhoto, setter: setLicensePhoto },
        { label: 'OR/CR Photo', image: orCrPhoto, setter: setOrCrPhoto },
      ].map((item, idx) => (
        <View key={idx} style={{ marginBottom: 16 }}>
          <Button 
            title={`Pick ${item.label}${item.image ? ' ✓' : ''}`} 
            onPress={() => pickImage(item.setter)}
            color={item.image ? '#4CAF50' : undefined}
          />
          {item.image?.uri && (
            <Image
              source={{ uri: item.image.uri }}
              style={{ 
                width: 200, 
                height: 200, 
                marginVertical: 8, 
                borderRadius: 8, 
                alignSelf: 'center',
                borderWidth: 1,
                borderColor: '#ddd'
              }}
              resizeMode="cover"
            />
          )}
        </View>
      ))}

      <View style={{ marginTop: 20 }}>
        <Button 
          title={loading ? 'Registering...' : 'Register Driver'} 
          onPress={handleRegister} 
          disabled={loading}
          color="#2196F3"
        />
      </View>
    </ScrollView>
  );
};

export default RegisterForm;