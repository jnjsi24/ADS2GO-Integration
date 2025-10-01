import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import tabletRegistrationService, { ConnectionDetails } from '../services/tabletRegistration';
import QRCodeScanner from '../components/QRCodeScanner';
import { useDeviceStatus } from '@/contexts/DeviceStatusContext';

export default function RegistrationScreen() {
  const { setMaterialId: setMaterialIdInContext } = useDeviceStatus();
  const { force } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [materialId, setMaterialId] = useState('');
  const [slotNumber, setSlotNumber] = useState('');
  const [carGroupId, setCarGroupId] = useState('');
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [existingConnection, setExistingConnection] = useState<any>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    // Skip registration check if coming from unregister (force=true)
    if (!force) {
      checkExistingRegistration();
    } else {
      console.log('Skipping registration check - coming from unregister');
    }
  }, [force]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkExistingConnection();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [materialId, slotNumber]);

  const checkExistingRegistration = async () => {
    try {
      // Add a small delay to ensure any previous cleanup operations are complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const registration = await tabletRegistrationService.getRegistrationData();
      console.log('Registration check - found registration:', registration);
      
      if (registration && registration.materialId && registration.deviceId) {
        // Only redirect if we have a complete registration
        Alert.alert(
          'Already Registered',
          'This tablet is already registered. You will be redirected to the main screen.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/(tabs)')
            }
          ]
        );
      } else if (registration) {
        // If we have partial registration data, clear it and continue
        console.log('Found incomplete registration data, clearing it');
        await tabletRegistrationService.clearRegistration();
      }
    } catch (error) {
      console.error('Error checking registration:', error);
    }
  };

  const checkExistingConnection = async () => {
    if (!materialId.trim() || !slotNumber.trim()) {
      setExistingConnection(null);
      return;
    }

    setCheckingConnection(true);
    try {
      const result = await tabletRegistrationService.checkExistingConnection(
        materialId.trim(),
        parseInt(slotNumber)
      );
      
      if (result.success) {
        setExistingConnection(result.isConnected ? result.connectedDevice : null);
      } else {
        setExistingConnection(null);
      }
    } catch (error) {
      console.error('Error checking existing connection:', error);
      setExistingConnection(null);
    } finally {
      setCheckingConnection(false);
    }
  };

  const validateInputs = (): boolean => {
    if (!materialId.trim()) {
      Alert.alert('Error', 'Please enter Material ID');
      return false;
    }
    if (!slotNumber.trim()) {
      Alert.alert('Error', 'Please enter Slot Number');
      return false;
    }
    
    // If carGroupId is empty, generate a default one
    if (!carGroupId.trim()) {
      const defaultCarGroupId = `GRP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      setCarGroupId(defaultCarGroupId);
      Alert.alert('Info', `Using generated Car Group ID: ${defaultCarGroupId}`);
    } else if (!/^GRP-[A-Z0-9]{8}$/.test(carGroupId.trim())) {
      Alert.alert('Error', 'Car Group ID must be in the format GRP-XXXXXXXX where X is an uppercase letter or number');
      return false;
    }
    
    const slotNum = parseInt(slotNumber);
    if (isNaN(slotNum) || slotNum < 1 || slotNum > 2) {
      Alert.alert('Error', 'Slot Number must be 1 or 2');
      return false;
    }

    if (existingConnection) {
      Alert.alert('Error', 'Another tablet is already connected to this material and slot combination. Please choose different details.');
      return false;
    }
    
    return true;
  };

  const handleConnect = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    
    try {
      const connectionDetails = {
        materialId: materialId.trim(),
        slotNumber: parseInt(slotNumber),
        carGroupId: carGroupId.trim()
      };

      const result = await tabletRegistrationService.registerTablet(connectionDetails);
      
      if (result.success) {
        // Set the material ID in the device status context
        console.log('Registration successful, setting material ID:', materialId.trim());
        await setMaterialIdInContext(materialId.trim());
        
        // Add a small delay to ensure the material ID is properly set
        await new Promise(resolve => setTimeout(resolve, 200));
        
        Alert.alert(
          'Success!',
          'Tablet registered successfully. You will be redirected to the main screen.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.push('/(tabs)');
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

  const handleQRScanSuccess = (details: ConnectionDetails) => {
    setMaterialId(details.materialId);
    setSlotNumber(details.slotNumber.toString());
    setCarGroupId(details.carGroupId);
    
    // Automatically check for existing connection
    checkExistingConnection(details.materialId, details.slotNumber);
  };

  const handleScanQR = () => {
    setShowQRScanner(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tablet Registration</Text>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>Connect Your Tablet</Text>
          <Text style={styles.subtitle}>
            Enter connection details to register this tablet
          </Text>
        </View>

        {/* Connection Form */}
        <View style={styles.formContainer}>
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
              placeholder="Leave empty to auto-generate (GRP-XXXXXXXX)"
              placeholderTextColor="#999"
              editable={!loading}
            />
            <Text style={styles.hint}>Format: GRP-XXXXXXXX (8 uppercase alphanumeric characters)</Text>
          </View>

          {/* Connection Status */}
          {(checkingConnection || existingConnection !== null) && (
            <View style={styles.connectionStatusContainer}>
              {checkingConnection ? (
                <View style={styles.connectionStatus}>
                  <ActivityIndicator size="small" color="#3498db" />
                  <Text style={styles.connectionStatusText}>Checking connection status...</Text>
                </View>
              ) : existingConnection ? (
                <View style={[styles.connectionStatus, styles.existingConnection]}>
                  <Text style={styles.connectionStatusTitle}>⚠️ Device Already Connected</Text>
                  <Text style={styles.connectionStatusText}>
                    Another tablet is already connected to this material and slot:
                  </Text>
                  <View style={styles.connectedDeviceInfo}>
                    <Text style={styles.deviceInfoText}>
                      <Text style={styles.deviceInfoLabel}>Device ID:</Text> {existingConnection.deviceId}
                    </Text>
                    <Text style={styles.deviceInfoText}>
                      <Text style={styles.deviceInfoLabel}>Car Group ID:</Text> {existingConnection.carGroupId}
                    </Text>
                    <Text style={styles.deviceInfoText}>
                      <Text style={styles.deviceInfoLabel}>Status:</Text> {existingConnection.status}
                    </Text>
                    <Text style={styles.deviceInfoText}>
                      <Text style={styles.deviceInfoLabel}>Last Active:</Text> {new Date(existingConnection.lastReportedAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.connectionWarningText}>
                    You cannot register this tablet to the same material and slot combination.
                  </Text>
                </View>
              ) : (
                <View style={[styles.connectionStatus, styles.availableConnection]}>
                  <Text style={styles.connectionStatusTitle}>✅ Slot Available</Text>
                  <Text style={styles.connectionStatusText}>
                    This material and slot combination is available for registration.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.scanButton]}
              onPress={handleScanQR}
              disabled={loading}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="qr-code" size={20} color="white" />
                <Text style={styles.buttonText}>📷 Enter QR Data</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.connectButton]}
              onPress={handleConnect}
              disabled={loading || existingConnection}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {existingConnection ? '❌ Cannot Connect (Device Exists)' : '🔗 Connect Tablet'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
          <View style={styles.instructionSteps}>
            <Text style={styles.instructionStep}>1. Get QR code data from the admin dashboard</Text>
            <Text style={styles.instructionStep}>2. Enter QR data or input details manually</Text>
            <Text style={styles.instructionStep}>3. Click "Connect Tablet" to register</Text>
            <Text style={styles.instructionStep}>4. Once registered, the tablet will auto-connect on startup</Text>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpTitle}>❓ Need Help?</Text>
          <Text style={styles.helpText}>
            Contact your system administrator to get the correct connection details for your tablet.
          </Text>
        </View>
      </View>

      {/* QR Code Scanner Modal */}
      {showQRScanner && (
        <QRCodeScanner
          onScanSuccess={handleQRScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 60,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    marginTop: -10,
  },
  buttonGroup: {
    marginTop: 10,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  instructionSteps: {
    gap: 12,
  },
  instructionStep: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  helpContainer: {
    backgroundColor: '#e8f4fd',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  connectionStatusContainer: {
    marginTop: 20,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  existingConnection: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
  },
  availableConnection: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
  },
  connectionStatusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  connectionStatusText: {
    fontSize: 14,
    marginLeft: 8,
  },
  connectedDeviceInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  deviceInfoText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
    lineHeight: 16,
  },
  deviceInfoLabel: {
    fontWeight: '600',
  },
  connectionWarningText: {
    fontSize: 12,
    color: '#e74c3c',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
