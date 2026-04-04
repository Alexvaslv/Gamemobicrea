import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration
// In a real app, these would be in environment variables or a config file
const firebaseConfig = {
  apiKey: "AIzaSy...", // Placeholder, should be replaced with real key
  authDomain: "gen-lang-client-0421334866.firebaseapp.com",
  projectId: "gen-lang-client-0421334866",
  storageBucket: "gen-lang-client-0421334866.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
