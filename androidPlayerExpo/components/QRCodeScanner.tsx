import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConnectionDetails {
  materialId: string;
  slotNumber: number;
  carGroupId: string;
}

interface QRCodeScannerProps {
  onScanSuccess: (details: ConnectionDetails) => void;
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const [qrCodeData, setQrCodeData] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handleQRCodeInput = () => {
    if (!qrCodeData.trim()) {
      Alert.alert('Error', 'Please enter QR code data');
      return;
    }

    try {
      const connectionDetails: ConnectionDetails = JSON.parse(qrCodeData);
      
      // Validate the scanned data
      if (!connectionDetails.materialId || !connectionDetails.slotNumber || !connectionDetails.carGroupId) {
        Alert.alert(
          'Invalid QR Code',
          'The QR code data does not contain valid connection details.',
          [
            { text: 'Try Again', onPress: () => setQrCodeData('') },
            { text: 'Cancel', onPress: onClose }
          ]
        );
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        'Connection Details Found',
        `Material ID: ${connectionDetails.materialId}\nSlot: ${connectionDetails.slotNumber}\nCar Group: ${connectionDetails.carGroupId}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Use These Details', 
            onPress: () => {
              onScanSuccess(connectionDetails);
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(
        'Invalid QR Code',
        'The QR code data could not be parsed. Please check the format and try again.',
        [
          { text: 'Try Again', onPress: () => setQrCodeData('') },
          { text: 'Cancel', onPress: onClose }
        ]
      );
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>QR Code Scanner</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.qrIconContainer}>
            <Ionicons name="qr-code" size={80} color="#3674B5" />
          </View>
          
          <Text style={styles.title}>Enter QR Code Data</Text>
          <Text style={styles.subtitle}>
            Paste the QR code data from the admin dashboard
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={qrCodeData}
              onChangeText={setQrCodeData}
              placeholder="Paste QR code JSON data here..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleQRCodeInput}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.buttonText}>Process QR Data</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.helpContainer}>
            <Text style={styles.helpTitle}>How to get QR code data:</Text>
            <Text style={styles.helpText}>1. Open the admin dashboard</Text>
            <Text style={styles.helpText}>2. Go to Materials → Find HEADDRESS material</Text>
            <Text style={styles.helpText}>3. Click the QR code button</Text>
            <Text style={styles.helpText}>4. Copy the JSON data from the modal</Text>
            <Text style={styles.helpText}>5. Paste it here</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#3674B5',
  },
  closeButton: {
    padding: 10,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  qrIconContainer: {
    marginTop: 40,
    marginBottom: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#2c3e50',
    minHeight: 120,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  scanButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#95a5a6',
  },
  cancelButtonText: {
    color: '#95a5a6',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default QRCodeScanner;
