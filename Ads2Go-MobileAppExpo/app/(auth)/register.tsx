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
  licensePictureURL?: any;
  vehiclePlateNumber?: string;
  vehicleType: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehiclePhotoURL?: any;
  orCrPictureURL?: any;
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
          fileName: `photo-${Date.now()}.jpg`,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const formData = new FormData();

      // Operations
      formData.append(
        'operations',
        JSON.stringify({
          query: `
            mutation CreateDriver($input: CreateDriverInput!) {
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
                }
              }
            }
          `,
          variables: {
            input: {
              firstName,
              middleName,
              lastName,
              email,
              contactNumber,
              password,
              address,
              licenseNumber,
              licensePictureURL: null,
              vehiclePlateNumber,
              vehicleType,
              vehicleModel,
              vehicleYear,
              vehiclePhotoURL: null,
              orCrPictureURL: null,
              preferredMaterialType,
              profilePicture: null,
            },
          },
        })
      );

      // Map
      const map: any = {};
      let i = 0;
      if (profilePicture) map[i++] = ['variables.input.profilePicture'];
      if (vehiclePhoto) map[i++] = ['variables.input.vehiclePhotoURL'];
      if (licensePhoto) map[i++] = ['variables.input.licensePictureURL'];
      if (orCrPhoto) map[i++] = ['variables.input.orCrPictureURL'];
      formData.append('map', JSON.stringify(map));

      // Append files
      i = 0;
      if (profilePicture) formData.append(`${i++}`, { uri: profilePicture.uri, type: profilePicture.type, name: profilePicture.fileName } as any);
      if (vehiclePhoto) formData.append(`${i++}`, { uri: vehiclePhoto.uri, type: vehiclePhoto.type, name: vehiclePhoto.fileName } as any);
      if (licensePhoto) formData.append(`${i++}`, { uri: licensePhoto.uri, type: licensePhoto.type, name: licensePhoto.fileName } as any);
      if (orCrPhoto) formData.append(`${i++}`, { uri: orCrPhoto.uri, type: orCrPhoto.type, name: orCrPhoto.fileName } as any);

      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });

      const result = await response.json();

      if (result.data?.createDriver.success) {
        Alert.alert('Success', result.data.createDriver.message);
        console.log('Token:', result.data.createDriver.token);
      } else {
        Alert.alert('Error', result.data?.createDriver.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Form Fields */}
      <Text>First Name</Text>
      <TextInput value={firstName} onChangeText={setFirstName} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Middle Name</Text>
      <TextInput value={middleName} onChangeText={setMiddleName} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Last Name</Text>
      <TextInput value={lastName} onChangeText={setLastName} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Email</Text>
      <TextInput value={email} onChangeText={setEmail} style={{ borderWidth: 1, marginBottom: 8 }} keyboardType="email-address" />
      <Text>Contact Number</Text>
      <TextInput value={contactNumber} onChangeText={setContactNumber} style={{ borderWidth: 1, marginBottom: 8 }} keyboardType="phone-pad" />
      <Text>Password</Text>
      <TextInput value={password} onChangeText={setPassword} style={{ borderWidth: 1, marginBottom: 8 }} secureTextEntry />
      <Text>Address</Text>
      <TextInput value={address} onChangeText={setAddress} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>License Number</Text>
      <TextInput value={licenseNumber} onChangeText={setLicenseNumber} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Vehicle Plate Number</Text>
      <TextInput value={vehiclePlateNumber} onChangeText={setVehiclePlateNumber} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Vehicle Type</Text>
      <TextInput value={vehicleType} onChangeText={setVehicleType} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Vehicle Model</Text>
      <TextInput value={vehicleModel} onChangeText={setVehicleModel} style={{ borderWidth: 1, marginBottom: 8 }} />
      <Text>Vehicle Year</Text>
      <TextInput
        value={vehicleYear?.toString() || ''}
        onChangeText={text => setVehicleYear(Number(text))}
        style={{ borderWidth: 1, marginBottom: 8 }}
        keyboardType="numeric"
      />
      <Text>Preferred Material Types (comma-separated)</Text>
      <TextInput
        value={preferredMaterialType.join(',')}
        onChangeText={text => setPreferredMaterialType(text.split(',').map(item => item.trim()))}
        style={{ borderWidth: 1, marginBottom: 16 }}
      />

      {/* Image Pickers */}
      {[
        { label: 'Profile Picture', image: profilePicture, setter: setProfilePicture },
        { label: 'Vehicle Photo', image: vehiclePhoto, setter: setVehiclePhoto },
        { label: 'License Photo', image: licensePhoto, setter: setLicensePhoto },
        { label: 'OR/CR Photo', image: orCrPhoto, setter: setOrCrPhoto },
      ].map((item, idx) => (
        <View key={idx} style={{ marginBottom: 16 }}>
          <Button title={`Pick ${item.label}`} onPress={() => pickImage(item.setter)} />
          {item.image?.uri && (
            <Image
              source={{ uri: item.image.uri }}
              style={{ width: 200, height: 200, marginVertical: 8, borderRadius: 8, alignSelf: 'center' }}
              resizeMode="contain"
            />
          )}
        </View>
      ))}

      <Button title={loading ? 'Registering...' : 'Register'} onPress={handleRegister} disabled={loading} />
    </ScrollView>
  );
};

export default RegisterForm;
