import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import tabletRegistrationService, { ConnectionDetails } from '../services/tabletRegistration';

export default function ManualConnectScreen() {
  const [loading, setLoading] = useState(false);
  
  // Manual input fields
  const [materialId, setMaterialId] = useState('');
  const [slotNumber, setSlotNumber] = useState('');
  const [carGroupId, setCarGroupId] = useState('');

  const validateInputs = (): boolean => {
    if (!materialId.trim()) {
      Alert.alert('Error', 'Please enter Material ID');
      return false;
    }
    if (!slotNumber.trim()) {
      Alert.alert('Error', 'Please enter Slot Number');
      return false;
    }
    if (!carGroupId.trim()) {
      Alert.alert('Error', 'Please enter Car Group ID');
      return false;
    }
    
    const slotNum = parseInt(slotNumber);
    if (isNaN(slotNum) || slotNum < 1 || slotNum > 2) {
      Alert.alert('Error', 'Slot Number must be 1 or 2');
      return false;
    }
    
    return true;
  };

  const handleConnect = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    
    try {
      const connectionDetails: ConnectionDetails = {
        materialId: materialId.trim(),
        slotNumber: parseInt(slotNumber),
        carGroupId: carGroupId.trim()
      };

      const result = await tabletRegistrationService.registerTablet(connectionDetails);
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'Tablet registered successfully. You will now be redirected to the main screen.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to main screen
                console.log('Registration successful, redirecting to main screen');
              }
            }
          ]
        );
      } else {
        Alert.alert('Registration Failed', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanQR = () => {
    Alert.alert(
      'QR Code Scanning',
      'QR code scanning feature will be implemented in the next version. For now, please enter the connection details manually.',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Tablet Registration</Text>
          <Text style={styles.subtitle}>
            Enter connection details to register this tablet
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Material ID</Text>
            <TextInput
              style={styles.input}
              value={materialId}
              onChangeText={setMaterialId}
              placeholder="e.g., 68b1f45b9384e0cec97f66aa"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Slot Number</Text>
            <TextInput
              style={styles.input}
              value={slotNumber}
              onChangeText={setSlotNumber}
              placeholder="1 or 2"
              keyboardType="numeric"
              maxLength={1}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Car Group ID</Text>
            <TextInput
              style={styles.input}
              value={carGroupId}
              onChangeText={setCarGroupId}
              placeholder="e.g., GRP-E522A5CC"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.scanButton]}
              onPress={handleScanQR}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Scan QR Code (Coming Soon)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.connectButton]}
              onPress={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Connect Tablet</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>Instructions:</Text>
          <Text style={styles.infoText}>1. Get connection details from the admin dashboard</Text>
          <Text style={styles.infoText}>2. Enter the details manually</Text>
          <Text style={styles.infoText}>3. Click "Connect Tablet" to register</Text>
          <Text style={styles.infoText}>4. Once registered, the tablet will auto-connect on startup</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  buttonGroup: {
    marginTop: 10,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  scanButton: {
    backgroundColor: '#95a5a6',
  },
  connectButton: {
    backgroundColor: '#27ae60',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
    lineHeight: 20,
  },
});
