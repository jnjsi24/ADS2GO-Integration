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
  apiKey: "AIzaSyBcJD2Ttm5ykalj-PK8T4ttgodGqVNc-Do",
  authDomain: "ads2go-6ead4.firebaseapp.com",
  projectId: "ads2go-6ead4",
  storageBucket: "ads2go-6ead4.firebasestorage.app",
  messagingSenderId: "380830146533",
  appId: "1:380830146533:web:86708e4a57a07ab59f590c",
  measurementId: "G-P0TNVP9BEX"
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
