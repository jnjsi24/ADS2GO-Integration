import 'dotenv/config';

// Load environment variables with fallbacks
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ads2go-server.onrender.com';
const SYNC_INTERVAL = process.env.EXPO_PUBLIC_SYNC_INTERVAL || '30000';
const DEFAULT_AD_DURATION = process.env.EXPO_PUBLIC_DEFAULT_AD_DURATION || '15000';

console.log('🔧 Environment Configuration:', {
  API_URL,
  SYNC_INTERVAL,
  DEFAULT_AD_DURATION,
  NODE_ENV: process.env.NODE_ENV
});

export default {
  expo: {
    name: "androidPlayereExpo",
    slug: "androidPlayereExpo",
    version: "1.0.0",
    orientation: "default", // Allow both portrait and landscape
    icon: "./assets/images/icon.png",
    scheme: "androidplayereexpo",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true
    },
    android: {
      package: "com.cjeg10.androidPlayereExpo",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera to scan QR codes for tablet registration.",
          microphonePermission: false
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      EXPO_PUBLIC_API_URL: API_URL,
      EXPO_PUBLIC_TABLET_ID: process.env.EXPO_PUBLIC_TABLET_ID,
      EXPO_PUBLIC_MATERIAL_ID: process.env.EXPO_PUBLIC_MATERIAL_ID,
      EXPO_PUBLIC_SYNC_INTERVAL: SYNC_INTERVAL,
      EXPO_PUBLIC_DEFAULT_AD_DURATION: DEFAULT_AD_DURATION,
    }
  }
};
