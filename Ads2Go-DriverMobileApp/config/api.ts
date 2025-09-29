import Constants from 'expo-constants';

// API configuration - Updated to use environment variables for IP address
const EXPO_PUBLIC_API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
const serverIp = process.env.EXPO_PUBLIC_SERVER_IP || '192.168.100.22';
const serverPort = process.env.EXPO_PUBLIC_SERVER_PORT || '5000';
const serverUrl = `http://${serverIp}:${serverPort}`;

console.log('🔍 EXPO_PUBLIC_API_URL:', EXPO_PUBLIC_API_URL);
console.log('🔍 Server IP:', serverIp);
console.log('🔍 Server Port:', serverPort);

const API_CONFIG = {
  // Use environment variable with fallback to constructed URL
  API_URL: `${EXPO_PUBLIC_API_URL || serverUrl}/graphql`,
  
  // Base URL for REST API calls (without /graphql)
  BASE_URL: EXPO_PUBLIC_API_URL || serverUrl,
  
  // Server configuration
  SERVER_IP: serverIp,
  SERVER_PORT: serverPort,
  SERVER_URL: serverUrl,

  // For iOS simulator or Android emulator on the same machine
  // API_URL: "http://localhost:5000/graphql",
  // BASE_URL: "http://localhost:5000",
  
  // For Android emulator alternative
  // API_URL: "http://10.0.2.2:5000/graphql",
  // BASE_URL: "http://10.0.2.2:5000"
};

console.log('🔍 Final API_CONFIG:', API_CONFIG);

export default API_CONFIG;