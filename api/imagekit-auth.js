import crypto from 'node:crypto';

// Vercel serverless function: returns a short-lived ImageKit upload signature.
// Runs at /api/imagekit-auth on the deployed site. Requires the IMAGEKIT_PRIVATE_KEY
// env var to be set in the Vercel project settings (NOT VITE_-prefixed — server only).
export default function handler(req, res) {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    res.status(500).json({ error: 'ImageKit not configured (IMAGEKIT_PRIVATE_KEY missing)' });
    return;
  }
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 2400;
  const signature = crypto.createHmac('sha1', privateKey).update(token + expire).digest('hex');
  res.status(200).json({ token, expire, signature });
}
