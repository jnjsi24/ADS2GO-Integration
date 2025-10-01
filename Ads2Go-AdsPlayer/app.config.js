import 'dotenv/config';

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
      "expo-secure-store"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_TABLET_ID: process.env.EXPO_PUBLIC_TABLET_ID,
      EXPO_PUBLIC_MATERIAL_ID: process.env.EXPO_PUBLIC_MATERIAL_ID,
      EXPO_PUBLIC_SYNC_INTERVAL: process.env.EXPO_PUBLIC_SYNC_INTERVAL,
      EXPO_PUBLIC_DEFAULT_AD_DURATION: process.env.EXPO_PUBLIC_DEFAULT_AD_DURATION,
    }
  }
};
