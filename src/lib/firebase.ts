import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDtqxjeaq0D5HCB-vLcTNCgjZecJiA2d58",
  authDomain: "sketchware-1c715.firebaseapp.com",
  databaseURL: "https://sketchware-1c715.firebaseio.com",
  projectId: "sketchware-1c715",
  storageBucket: "sketchware-1c715.appspot.com",
  messagingSenderId: "587114449743",
  appId: "1:587114449743:web:f70dd5281caf73c39b933a",
  measurementId: "G-PS8D1S7NK5"
};

export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const isFirebaseConfigured = true;
