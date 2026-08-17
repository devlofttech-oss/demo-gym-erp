// Firebase Admin SDK init for Vercel serverless functions.
// Requires the FIREBASE_SERVICE_ACCOUNT env var (the full service-account JSON,
// as a single string) set in Vercel project settings — server-only, NOT VITE_.
// The Admin SDK bypasses Firestore security rules, so all writes here are trusted.
import admin from 'firebase-admin';

function init() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  let serviceAccount;
  try {
    serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

export function getAdmin() {
  return init();
}

export function getDb() {
  return init().firestore();
}

// Verify the "Authorization: Bearer <id-token>" header and return the decoded token.
export async function verifyIdToken(authHeader) {
  const match = /^Bearer (.+)$/.exec(authHeader || '');
  if (!match) throw new Error('Missing or malformed Authorization token');
  return init().auth().verifyIdToken(match[1]);
}
