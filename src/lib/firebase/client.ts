"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Public config — safe to expose to the browser, mirrors Firebase's own docs.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// True once the NEXT_PUBLIC_FIREBASE_* vars are filled in (see .env.example).
// Checked before every getFirebaseAuth() call so the sign-in page can render
// (Google + Telegram still work) instead of crashing while email sign-in is
// still being set up.
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let firebaseApp: FirebaseApp | undefined;
let firebaseAuthInstance: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!firebaseConfigured) {
    throw new Error("Firebase isn't configured yet — set the NEXT_PUBLIC_FIREBASE_* env vars (see .env.example).");
  }
  if (!firebaseAuthInstance) {
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    firebaseAuthInstance = getAuth(firebaseApp);
  }
  return firebaseAuthInstance;
}
