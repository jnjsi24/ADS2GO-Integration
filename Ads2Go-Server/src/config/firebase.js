const { initializeApp } = require('firebase/app');
const { getStorage, connectStorageEmulator } = require('firebase/storage');
const admin = require('firebase-admin');

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const storage = getStorage(app);

// Initialize Firebase Admin
let adminApp;
try {
  adminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
} catch (error) {
  // App might already be initialized
  try {
    adminApp = admin.app();
  } catch (appError) {
    console.error('Failed to initialize Firebase Admin:', appError.message);
    adminApp = null;
  }
}

// Admin services for storage operations
const adminStorage = adminApp ? admin.storage(adminApp) : null;

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    console.log('Firebase Storage emulator already connected or not available');
  }
}

module.exports = {
  app,
  storage,
  adminApp,
  adminStorage
};
