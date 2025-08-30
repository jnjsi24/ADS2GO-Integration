import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native";
import tabletRegistrationService, { ConnectionDetails } from '../services/tabletRegistration';

export default function RegistrationScreen() {
  const [loading, setLoading] = useState(false);
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
      const connectionDetails = {
        materialId: materialId.trim(),
        slotNumber: parseInt(slotNumber),
        carGroupId: carGroupId.trim()
      };

      const result = await tabletRegistrationService.registerTablet(connectionDetails);
      
      if (result.success) {
        Alert.alert(
          'Success!',
          'Tablet registered successfully. You will be redirected to the main screen.',
          [
            {
              text: 'OK',
              onPress: () => {
                // For now, just reload the app
                console.log('Registration successful, reloading app...');
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
      'QR code scanning will be available in the next update. For now, please enter the connection details manually.',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
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
              placeholder="e.g., GRP-E522A5CC"
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.scanButton]}
              onPress={handleScanQR}
              disabled={loading}
            >
              <Text style={styles.buttonText}>📷 Scan QR Code (Coming Soon)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.connectButton]}
              onPress={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🔗 Connect Tablet</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
          <View style={styles.instructionSteps}>
            <Text style={styles.instructionStep}>1. Get connection details from the admin dashboard</Text>
            <Text style={styles.instructionStep}>2. Enter the details manually</Text>
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
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
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
    borderWidth: 2,
    borderColor: '#e1e8ed',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
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
});
