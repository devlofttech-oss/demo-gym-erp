// Firebase Admin SDK init for Vercel serverless functions (ESM-safe modular API).
// Requires the FIREBASE_SERVICE_ACCOUNT env var (the full service-account JSON,
// as a single string) set in Vercel project settings — server-only, NOT VITE_.
// The Admin SDK bypasses Firestore security rules, so all writes here are trusted.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function app() {
  const existing = getApps();
  if (existing.length) return existing[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  let serviceAccount;
  try {
    serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

export function getDb() {
  return getFirestore(app());
}

// Re-export FieldValue so callers can use FieldValue.serverTimestamp().
export { FieldValue };

// Verify the "Authorization: Bearer <id-token>" header and return the decoded token.
export async function verifyIdToken(authHeader) {
  const match = /^Bearer (.+)$/.exec(authHeader || '');
  if (!match) throw new Error('Missing or malformed Authorization token');
  return getAuth(app()).verifyIdToken(match[1]);
}
