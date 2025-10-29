import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCKB3zKrAUvWBJ3E83tLlLw5vGvfrOqX1E",
  authDomain: "exam9-1.firebaseapp.com",
  projectId: "exam9-1",
  storageBucket: "exam9-1.appspot.com", 
  messagingSenderId: "479705895775",
  appId: "1:479705895775:web:49446745724018e8cd5cea",
  measurementId: "G-0EGXDMH6KJ"
};

console.log('Firebase Config:', {
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
});

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const storage = getStorage(app);

console.log('Firebase initialized successfully');