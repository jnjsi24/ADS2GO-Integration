import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAJMHe8KDEvARnVjbe9ZOxVy9iXS_jYNfo",
  authDomain: "adstogo-305d8.firebaseapp.com",
  projectId: "adstogo-305d8",
  storageBucket: "adstogo-305d8.appspot.com", // Fixed storage bucket URL
  messagingSenderId: "830261926639",
  appId: "1:830261926639:web:d275a5680f44849a36991a",
  measurementId: "G-RTFBR7Y5BH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { auth, db, storage, analytics };