import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Validate required environment variables
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_MEASUREMENT_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Firebase config loaded from environment variables

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
console.log("🔥 Firebase initialized successfully");

// --- Initialize Services ---
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let analytics;
isSupported().then((analyticsSupported) => {
  if (analyticsSupported) {
    try {
      // Initialize analytics with the correct measurement ID
      analytics = getAnalytics(app);
      console.log("📊 Firebase Analytics initialized");
    } catch (error) {
      console.warn("⚠️ Firebase Analytics initialization failed:", error.message);
      analytics = null;
    }
  } else {
    console.log("ℹ️ Firebase Analytics not supported in this environment");
  }
}).catch((error) => {
  console.warn("⚠️ Firebase Analytics check failed:", error.message);
  analytics = null;
});

// --- Google Auth ---
const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log(`✅ Google Sign-In success: ${user.uid} (${user.email})`);
    return user;
  } catch (error) {
    console.error("❌ Google Sign-In failed:", error.message);
    throw error;
  }
};

// --- Monitor Auth State ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log(`🔑 Firebase Auth: User ${user.uid} (${user.email}) is signed in`);
  } else {
    console.log("🔒 Firebase Auth: No user is signed in");
  }
});

export { auth, db, storage, analytics, app };
