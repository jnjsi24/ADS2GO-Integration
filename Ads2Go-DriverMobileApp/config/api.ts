import Constants from 'expo-constants';

// API configuration - Updated to match working AndroidPlayerExpo configuration
const EXPO_PUBLIC_API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
console.log('🔍 EXPO_PUBLIC_API_URL:', EXPO_PUBLIC_API_URL);

const API_CONFIG = {
  // Use environment variable like AndroidPlayerExpo, fallback to Mac IP
  API_URL: `${EXPO_PUBLIC_API_URL || 'http://192.168.1.59:5000'}/graphql`,
  
  // Base URL for REST API calls (without /graphql)
  BASE_URL: EXPO_PUBLIC_API_URL || 'http://192.168.1.59:5000',

  // For iOS simulator or Android emulator on the same machine
  // API_URL: "http://localhost:5000/graphql",
  // BASE_URL: "http://localhost:5000",
  
  // For Android emulator alternative
  // API_URL: "http://10.0.2.2:5000/graphql",
  // BASE_URL: "http://10.0.2.2:5000"
};

console.log('🔍 Final API_CONFIG:', API_CONFIG);

export default API_CONFIG;