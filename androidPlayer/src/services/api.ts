// src/services/api.ts
import axios from 'axios';

const BASE_URL = 'http://<YOUR_SERVER_IP>:4000'; // Update this to your backend API address

export const getAdsFromBackend = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/api/device/123/ads`);
    return res.data.ads || []; // make sure backend returns { ads: [...] }
  } catch (err) {
    console.error('Error fetching ads:', err);
    return [];
  }
};