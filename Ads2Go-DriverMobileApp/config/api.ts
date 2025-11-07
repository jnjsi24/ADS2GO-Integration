import Constants from 'expo-constants';

// API configuration - Updated to use Railway hosted server
const EXPO_PUBLIC_API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;

if (!EXPO_PUBLIC_API_URL) {
  console.error('❌ Missing required environment variable:');
  console.error('   EXPO_PUBLIC_API_URL:', EXPO_PUBLIC_API_URL);
  console.error('   Please check your .env file');
  throw new Error('Missing required environment variable EXPO_PUBLIC_API_URL for API configuration');
}

// Ensure the URL doesn't have a trailing slash
const baseUrl = EXPO_PUBLIC_API_URL.replace(/\/$/, '');

const API_CONFIG = {
  // GraphQL endpoint URL
  API_URL: `${baseUrl}/graphql`,
  
  // Base URL for REST API calls (without /graphql)
  BASE_URL: baseUrl,
  
  // Server configuration (for reference)
  SERVER_URL: baseUrl,
};

export default API_CONFIG;