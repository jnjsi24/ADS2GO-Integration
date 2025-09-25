// Test endpoints to verify they're correct
console.log('🧪 Testing endpoints...');

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Test the exact endpoints we're using
const endpoints = [
  '/screenTracking/screens',
  '/screenTracking/compliance', 
  '/screenTracking/adAnalytics'
];

endpoints.forEach(endpoint => {
  const fullUrl = `${API_BASE_URL}${endpoint}`;
  console.log('✅ Endpoint should be:', fullUrl);
});

// Test if there's any GraphQL interference
console.log('🔍 Checking for GraphQL interference...');
console.log('Current API_BASE_URL:', API_BASE_URL);

export const testEndpoints = endpoints;
