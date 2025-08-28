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

const firebaseConfig = {
  apiKey: "AIzaSyA5q4G5fQjZ8Z3Z1Z2Z3Z4Z5Z6Z7Z8Z9Z0", // You'll need to get this from Firebase Console
  authDomain: "ads2go-6ead4.firebaseapp.com",
  projectId: "ads2go-6ead4",
  storageBucket: "ads2go-6ead4.firebasestorage.app",
  messagingSenderId: "115930695724", // First part of client_id
  appId: "1:115930695724:web:your-app-id-here", // You'll need to get this from Firebase Console
  measurementId: "G-XXXXXXXXXX" // You'll need to get this from Firebase Console
};

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
    analytics = getAnalytics(app);
    console.log("📊 Firebase Analytics initialized");
  } else {
    console.log("ℹ️ Firebase Analytics not supported in this environment");
  }
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
