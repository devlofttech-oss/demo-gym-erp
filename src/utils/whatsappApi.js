import { auth } from '../firebase/config';

// Calls the serverless WhatsApp send endpoint (api/whatsapp/send.js).
// Sends via the Meta Cloud API using pre-approved templates.
//
//   type      'renewal' | 'payment' | 'class' | 'announcement'
//   memberIds array of member doc ids in gyms/{gymId}/members
//   extra     optional { body, className, amount }
//
// NOTE: this only works on the deployed Vercel site (or via `vercel dev`).
// Under plain `npm run dev` (Vite) the /api function isn't served.
export async function sendWhatsApp({ gymId, type, memberIds, extra }) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in');
  const token = await user.getIdToken();

  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ gymId, type, memberIds, extra }),
  });

  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || `Send failed (HTTP ${res.status})`);
  return data; // { sent, failed, results }
}
