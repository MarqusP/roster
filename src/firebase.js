import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Values come from Vite env vars (see .env.example). These are safe to expose
// to the browser -- Firebase's "config" is a public client identifier, not a
// secret. Access control is handled by Firestore security rules instead.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app;
if (firebaseReady) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export const db = firebaseReady ? getFirestore(app) : null;
export const auth = firebaseReady ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
