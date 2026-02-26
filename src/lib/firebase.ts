import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDv4v6g76Wk5u1RGamJsTXcrc-29P2y7kM",
  authDomain: "syria-chatroom.firebaseapp.com",
  databaseURL: "https://syria-chatroom-default-rtdb.firebaseio.com",
  projectId: "syria-chatroom",
  storageBucket: "syria-chatroom.firebasestorage.app",
  messagingSenderId: "944380810127",
  appId: "1:944380810127:web:167be944f45779fb5231fa",
  measurementId: "G-FFLHMXF0B3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = getFirestore(app);

export const storage = getStorage(app);

export const isFirebaseConfigured = true;
