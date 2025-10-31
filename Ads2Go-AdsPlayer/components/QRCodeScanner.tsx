import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, TextInput, Modal, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

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
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  
  // ✅ Use ref to prevent duplicate scans (refs update synchronously, unlike state)
  const isProcessingRef = useRef(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // ✅ Use ref check first (synchronous) to prevent duplicate scans
    if (isProcessingRef.current || scanned) {
      return;
    }
    
    // ✅ Set ref immediately (synchronous) to block any subsequent rapid calls
    isProcessingRef.current = true;
    setScanned(true);
    
    try {
      const connectionDetails: ConnectionDetails = JSON.parse(data);
      
      // Validate the scanned data
      if (!connectionDetails.materialId || !connectionDetails.slotNumber || !connectionDetails.carGroupId) {
        // ✅ Reset ref on validation error so user can try again
        isProcessingRef.current = false;
        Alert.alert(
          'Invalid QR Code',
          'The QR code data does not contain valid connection details.',
          [
            { text: 'Try Again', onPress: () => {
                isProcessingRef.current = false;
                setScanned(false);
              }
            },
            { text: 'Manual Input', onPress: () => {
                isProcessingRef.current = false;
                setShowManualInput(true);
              }
            },
            { text: 'Cancel', onPress: () => {
                isProcessingRef.current = false;
                onClose();
              }
            }
          ]
        );
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        'QR Code Scanned Successfully!',
        `Material ID: ${connectionDetails.materialId}\nSlot: ${connectionDetails.slotNumber}\nCar Group: ${connectionDetails.carGroupId}`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => {
              isProcessingRef.current = false;
              setScanned(false);
            }
          },
          { 
            text: 'Use These Details', 
            onPress: () => {
              isProcessingRef.current = false;
              onScanSuccess(connectionDetails);
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      // ✅ Reset ref on error so user can try again
      isProcessingRef.current = false;
      Alert.alert(
        'Invalid QR Code',
        'The QR code data could not be parsed. Please check the format and try again.',
        [
          { text: 'Try Again', onPress: () => {
              isProcessingRef.current = false;
              setScanned(false);
            }
          },
          { text: 'Manual Input', onPress: () => {
              isProcessingRef.current = false;
              setShowManualInput(true);
            }
          },
          { text: 'Cancel', onPress: () => {
              isProcessingRef.current = false;
              onClose();
            }
          }
        ]
      );
    }
  };

  const handleQRCodeInput = () => {
    if (!qrCodeData.trim()) {
      Alert.alert('Information Required', 'Please enter QR code data to continue');
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

  // If permission is not determined yet
  if (!permission) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerText}>QR Code Scanner</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.content}>
            <Text style={styles.title}>Loading...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // If permission is not granted
  if (!permission.granted) {
    return (
      <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
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
              <Ionicons name="camera" size={80} color="#3674B5" />
            </View>
            <Text style={styles.title}>Camera Permission Required</Text>
            <Text style={styles.subtitle}>
              Please grant camera permission to scan QR codes
            </Text>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={requestPermission}
            >
              <Ionicons name="camera" size={20} color="white" />
              <Text style={styles.buttonText}>Grant Camera Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowManualInput(true)}
            >
              <Text style={styles.cancelButtonText}>Manual Input Instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={true} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>QR Code Scanner</Text>
          <TouchableOpacity 
            style={styles.manualButton} 
            onPress={() => setShowManualInput(true)}
          >
            <Ionicons name="create" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {!showManualInput && (
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              facing="back"
              onBarcodeScanned={(scanned || isProcessingRef.current) ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerText}>Position QR code within the frame</Text>
              {scanned && (
                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={() => {
                    isProcessingRef.current = false;
                    setScanned(false);
                  }}
                >
                  <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {showManualInput && (
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
                placeholder='{"materialId":"...","slotNumber":1,"carGroupId":"..."}'
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
                onPress={() => setShowManualInput(false)}
              >
                <Text style={styles.cancelButtonText}>Back to Scanner</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.helpContainer}>
              <Text style={styles.helpTitle}>How to get QR code data:</Text>
              <Text style={styles.helpText}>1. Open the admin dashboard</Text>
              <Text style={styles.helpText}>2. Go to Materials → Find your material</Text>
              <Text style={styles.helpText}>3. Click the QR code button</Text>
              <Text style={styles.helpText}>4. Copy the JSON data</Text>
              <Text style={styles.helpText}>5. Paste it here</Text>
            </View>
          </View>
        )}
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
  manualButton: {
    padding: 10,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#3674B5',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanAgainButton: {
    marginTop: 20,
    backgroundColor: '#3674B5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanAgainText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
