import { Platform } from 'react-native';
import * as Location from 'expo-location';

// Use your local IP for development with physical devices or emulators
const API_URL = 'http://192.168.100.22:5000/graphql';

export interface AdDeployment {
  id: string;
  ad: {
    id: string;
    title: string;
    mediaFile: string;
    mediaUrl: string;
    durationDays: number;
    status: string;
    adFormat: string;
  };
  startTime: string;
  endTime: string;
}

export const fetchAds = async (location: { latitude: number; longitude: number }): Promise<AdDeployment[]> => {
  try {
    const query = `
      query GetActiveDeployments {
        getActiveDeployments {
          id
          ad {
            id
            title
            mediaFile
            mediaUrl
            durationDays
            status
            adFormat
          }
          startTime
          endTime
        }
      }
    `;

    const requestBody = {
      query
    };

    console.log('Sending request to:', API_URL);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response error:', errorText);
      throw new Error(`Server responded with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Response data:', JSON.stringify(responseData, null, 2));
    
    if (responseData.errors) {
      console.error('GraphQL errors:', responseData.errors);
      throw new Error(responseData.errors[0]?.message || 'Failed to fetch ads');
    }

    return responseData.data?.getActiveDeployments || [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
    
    console.error('Error in fetchAds:', {
      error,
      isNetworkError: errorMessage.includes('Network request failed')
    });
    
    throw new Error(`Failed to fetch ads: ${errorMessage}`);
  }
};
