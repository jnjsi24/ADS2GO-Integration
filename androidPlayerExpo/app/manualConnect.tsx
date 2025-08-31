import React, { useState, useEffect } from 'react';
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
import { router } from "expo-router/build/imperative-api";
import { Ionicons } from '@expo/vector-icons';
import tabletRegistrationService, { ConnectionDetails } from '../services/tabletRegistration';
import QRCodeScanner from '../components/QRCodeScanner';

export default function ManualConnectScreen() {
  const [loading, setLoading] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [existingConnection, setExistingConnection] = useState<any>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  
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
    checkExistingConnection();
  };

  const handleScanQR = () => {
    setShowQRScanner(true);
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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkExistingConnection();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [materialId, slotNumber]);

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

           <View style={styles.buttonGroup}>
             <TouchableOpacity
               style={[styles.button, styles.scanButton]}
               onPress={handleScanQR}
               disabled={loading}
             >
               <View style={styles.buttonContent}>
                 <Ionicons name="qr-code" size={20} color="white" />
                 <Text style={styles.buttonText}>Enter QR Data</Text>
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
                   {existingConnection ? 'Cannot Connect (Device Exists)' : 'Connect Tablet'}
                 </Text>
               )}
             </TouchableOpacity>
           </View>
        </View>

                 <View style={styles.info}>
           <Text style={styles.infoTitle}>Instructions:</Text>
           <Text style={styles.infoText}>1. Get QR code data from the admin dashboard</Text>
           <Text style={styles.infoText}>2. Enter QR data or input details manually</Text>
           <Text style={styles.infoText}>3. Click "Connect Tablet" to register</Text>
           <Text style={styles.infoText}>4. Once registered, the tablet will auto-connect on startup</Text>
         </View>
      </ScrollView>

      {/* QR Code Scanner Modal */}
      {showQRScanner && (
        <QRCodeScanner
          onScanSuccess={handleQRScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
