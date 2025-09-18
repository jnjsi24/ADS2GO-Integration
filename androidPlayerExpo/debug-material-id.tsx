import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

export default function DebugMaterialId() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const info = {
      processEnv: {
        EXPO_PUBLIC_MATERIAL_ID: process.env.EXPO_PUBLIC_MATERIAL_ID,
        EXPO_PUBLIC_TABLET_ID: process.env.EXPO_PUBLIC_TABLET_ID,
        EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      },
      constantsExtra: Constants.expoConfig?.extra,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('EXPO')),
      fallbackMaterialId: 'DGL-HEADDRESS-CAR-001',
      finalMaterialId: process.env.EXPO_PUBLIC_MATERIAL_ID || Constants.expoConfig?.extra?.EXPO_PUBLIC_MATERIAL_ID || 'DGL-HEADDRESS-CAR-001'
    };
    
    console.log('🔍 DEBUG MATERIAL ID INFO:', info);
    setDebugInfo(info);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Material ID</Text>
      <Text style={styles.text}>Process Env Material ID: {debugInfo.processEnv?.EXPO_PUBLIC_MATERIAL_ID || 'undefined'}</Text>
      <Text style={styles.text}>Constants Extra Material ID: {debugInfo.constantsExtra?.EXPO_PUBLIC_MATERIAL_ID || 'undefined'}</Text>
      <Text style={styles.text}>Final Material ID: {debugInfo.finalMaterialId}</Text>
      <Text style={styles.text}>All EXPO Keys: {debugInfo.allEnvKeys?.join(', ') || 'none'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    marginBottom: 5,
  },
});
