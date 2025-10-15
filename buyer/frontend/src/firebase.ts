// src/firebase.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyB8ZUOwfnZvnKmrbfMT0F6fzqkkaZkERWM",
  authDomain: "parkvech.firebaseapp.com",
  projectId: "parkvech",
  storageBucket: "parkvech.firebasestorage.app",
  messagingSenderId: "113484775657",
  appId: "1:113484775657:web:111eb6bcd375c9b7a63078",
  measurementId: "G-8Z12P6H2T4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
