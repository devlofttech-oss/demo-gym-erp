// LeminAi WhatsApp adapter — same interface as the Meta transport in whatsapp.js:
//   sendViaLeminai({ to, template, language, components }) -> { ok, wamid, error, raw }
//
// LeminAi (app.leminai.com) is an OFFICIAL Meta BSP. Its "Wrapper API" takes the
// SAME payload our buildTemplate() already produces (Meta Graph `components`
// format), so this is a near-direct passthrough to LeminAi instead of
// graph.facebook.com. Everything above the transport (templates, credits,
// logging) is unchanged.
//
// Docs: POST https://app.leminai.com/api/v1/messages/template
//   Auth:    Authorization: Bearer <API_KEY>
//   Body:    { to, template_name, language, components:[...] }  (components = Meta format)
//   Returns: WhatsApp message id (WAMID) synchronously.
//
// Env (set in Vercel):
//   WA_PROVIDER=leminai      flips the whole app to LeminAi (default 'meta')
//   LEMINAI_API_KEY          your LeminAi API key (dashboard > API)
//   LEMINAI_API_URL          optional endpoint override (defaults to the docs URL)
//   WHATSAPP_TEMPLATE_LANG   must match the approved template's language (e.g. en_US or en)

const DEFAULT_URL = 'https://app.leminai.com/api/v1/messages/template';

export async function sendViaLeminai({ to, template, language, components }) {
  const url = process.env.LEMINAI_API_URL || DEFAULT_URL;
  const key = process.env.LEMINAI_API_KEY;
  if (!key) {
    return { ok: false, error: 'LeminAi not configured (LEMINAI_API_KEY missing)' };
  }
  if (!to) return { ok: false, error: 'Invalid recipient phone number' };

  let res, data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,                           // digits with country code, e.g. 919876543210
        template_name: template,      // approved template name
        language,                     // language code, e.g. 'en_US'
        components: components || [],  // Meta Graph components format (from buildTemplate)
      }),
    });
    try { data = await res.json(); } catch { data = {}; }
  } catch (e) {
    return { ok: false, error: `Network error: ${e.message}` };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: data?.error?.message || data?.message || data?.error || `HTTP ${res.status}`,
      raw: data,
    };
  }
  // The Wrapper mirrors Meta's response; fall through common message-id fields.
  const wamid = data?.messages?.[0]?.id || data?.wamid || data?.message_id || data?.id || null;
  return { ok: true, wamid, raw: data };
}
