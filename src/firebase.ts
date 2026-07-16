import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { firebaseConfig, isConfigPlaceholder } from './firebase.config';

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (isConfigPlaceholder) {
    throw new Error('Firebase non configuré : remplissez src/firebase.config.ts');
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getDb(): Database {
  if (!db) db = getDatabase(ensureApp());
  return db;
}

export function getAuthInstance(): Auth {
  if (!auth) auth = getAuth(ensureApp());
  return auth;
}

/** Auth anonyme — résout quand un utilisateur est disponible. */
export async function signIn(): Promise<void> {
  const a = getAuthInstance();
  if (a.currentUser) return;
  await signInAnonymously(a);
}
