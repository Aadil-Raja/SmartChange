// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB-t_v2ogrvHuae0YDfdn_nlyC0_wpdbVc",
  authDomain: "smartchange-7e54c.firebaseapp.com",
  projectId: "smartchange-7e54c",
  storageBucket: "smartchange-7e54c.firebasestorage.app",
  messagingSenderId: "860919795899",
  appId: "1:860919795899:web:282a7cf3e0699c7cdb999e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export { signInWithPopup };
