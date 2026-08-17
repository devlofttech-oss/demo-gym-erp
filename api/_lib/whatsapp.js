// Thin wrapper around the Meta WhatsApp Cloud API "send message" endpoint.
// Reads the token + phone-number id from server-only env vars (set in Vercel).
//   WHATSAPP_TOKEN            - permanent access token (System User) or temp test token
//   WHATSAPP_PHONE_NUMBER_ID  - the "From" phone number id shown in Meta API Setup
//   WHATSAPP_API_VERSION      - optional, defaults to v21.0

const GRAPH = 'https://graph.facebook.com';

// Normalise an Indian phone number for the API: digits only, prepend 91 to a
// bare 10-digit number. Returns '' if there aren't enough digits.
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
}

// Send a pre-approved template message. `components` is the Meta components array
// (e.g. [{ type: 'body', parameters: [{ type: 'text', text: 'Ravi' }] }]).
export async function sendTemplateMessage({ to, template, language, components }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';

  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing)' };
  }
  if (!to) return { ok: false, error: 'Invalid recipient phone number' };

  const url = `${GRAPH}/${version}/${phoneNumberId}/messages`;
  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: language },
          components: components || [],
        },
      }),
    });
    data = await res.json();
  } catch (e) {
    return { ok: false, error: `Network error: ${e.message}` };
  }

  if (!res.ok) {
    return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, raw: data };
  }
  return { ok: true, wamid: data?.messages?.[0]?.id || null, raw: data };
}
