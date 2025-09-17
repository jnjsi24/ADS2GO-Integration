import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { DocumentUploader } from '../components/DocumentUploader';

export default function DocumentsScreen() {
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});

  const handleUploadSuccess = (documentType: string) => {
    setUploadedDocs(prev => ({
      ...prev,
      [documentType]: true
    }));
  };

  const allDocumentsUploaded = () => {
    const requiredDocs = ['license', 'vehicle', 'orcr'];
    return requiredDocs.every(doc => uploadedDocs[doc]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen 
        options={{ 
          title: 'My Documents',
          headerTitleStyle: styles.headerTitle,
          headerBackTitle: 'Back',
        }} 
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <MaterialIcons name="folder" size={24} color="#4CAF50" />
          <Text style={styles.title}>Required Documents</Text>
        </View>
        
        <Text style={styles.subtitle}>
          Please upload clear photos of the following documents. Make sure all text is readable.
        </Text>

        <View style={styles.uploadSection}>
          <DocumentUploader
            documentType="license"
            label="Driver's License"
            icon="credit-card"
            onUploadSuccess={() => handleUploadSuccess('license')}
            style={styles.uploader}
          />
          
          <DocumentUploader
            documentType="vehicle"
            label="Vehicle Registration"
            icon="directions-car"
            onUploadSuccess={() => handleUploadSuccess('vehicle')}
            style={styles.uploader}
          />
          
          <DocumentUploader
            documentType="orcr"
            label="OR/CR"
            icon="description"
            onUploadSuccess={() => handleUploadSuccess('orcr')}
            style={styles.uploader}
          />
          
          <DocumentUploader
            documentType="profile"
            label="Profile Photo"
            icon="face"
            onUploadSuccess={() => handleUploadSuccess('profile')}
            style={styles.uploader}
          />
        </View>
        
        {allDocumentsUploaded() && (
          <View style={styles.completionBanner}>
            <MaterialIcons name="check-circle" size={24} color="white" />
            <Text style={styles.completionText}>
              All required documents have been uploaded. Your account is under review.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploader: {
    marginBottom: 16,
  },
  completionBanner: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  completionText: {
    color: 'white',
    marginLeft: 8,
    flex: 1,
  },
});
