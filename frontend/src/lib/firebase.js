/**
 * Firebase initialization. All credentials come from VITE_* env vars
 * (see frontend/.env.example). If required vars are missing we do NOT
 * throw at import time; instead `firebaseConfigError` is set and the UI
 * renders a helpful setup message.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];
const missing = REQUIRED_KEYS.filter((key) => !firebaseConfig[key]);

export const firebaseConfigError = missing.length
  ? `Missing Firebase config: ${missing.join(', ')}. Copy frontend/.env.example to frontend/.env and fill in your project values.`
  : null;

let app = null;
let auth = null;
let rtdb = null;
let firestore = null;

if (!firebaseConfigError) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  rtdb = getDatabase(app);
  firestore = getFirestore(app);
}

export { app, auth, rtdb, firestore };
