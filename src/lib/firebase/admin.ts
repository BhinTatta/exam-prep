import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

// Node-only (service account). Never import this from a client component or
// edge middleware — see src/auth.ts, which mirrors the Telegram provider's
// "Node-only provider" split from src/auth.config.ts.
//
// Lazily initialized: importing this module (e.g. transitively via
// src/auth.ts on every page render) must be a no-op until email/password
// sign-in is actually attempted, so the rest of the app keeps working before
// FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are set.
// The firebase-admin SDK is pulled in via dynamic import() for the same
// reason — loading it eagerly runs its (heavy, CJS-quirky) module graph on
// every request, not just the sign-in path.
let app: App | undefined;

async function getFirebaseAdminApp(): Promise<App> {
  if (app) return app;

  const { initializeApp, getApps, getApp, cert } = await import("firebase-admin/app");
  if (getApps().length > 0) {
    app = getApp();
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin isn't configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (see .env.example)."
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export async function getFirebaseAdminAuth(): Promise<Auth> {
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(await getFirebaseAdminApp());
}
