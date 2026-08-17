// Maps a Kilos "message type" to the Meta template that carries it, and builds
// the template's variable parameters from a member + gym record.
//
// IMPORTANT: the template NAMES + LANGUAGE + the number/order of {{n}} variables
// here MUST match the templates you submit for approval in the Meta dashboard.
// See docs/whatsapp-golive.md for the exact template text to submit.
//
// Template names and language can be overridden per-deployment via env vars
// (handy if Meta approves a template under a slightly different name/locale).

const LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';

export const TEMPLATE_TYPES = ['renewal', 'payment', 'class', 'announcement'];

function tpl(envKey, fallback) {
  return process.env[envKey] || fallback;
}

// Build a single "body" component from an ordered list of variable values.
function bodyParams(values) {
  return [
    {
      type: 'body',
      parameters: values.map((v) => ({ type: 'text', text: String(v ?? '').trim() || '-' })),
    },
  ];
}

function money(n) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN')}`;
}

// Returns { template, language, category, components } for the given type.
export function buildTemplate(type, member, gym, extra = {}) {
  const gymName = gym?.name || 'our gym';
  const name = member?.name || 'there';

  switch (type) {
    // renewal_reminder(en, Utility): "Hi {{1}}, your {{2}} membership is scheduled to
    //   expire on {{3}}. Please contact us if you have any questions about your account."
    case 'renewal':
      return {
        template: tpl('WA_TPL_RENEWAL', 'renewal_reminder'),
        language: LANG,
        category: 'utility',
        components: bodyParams([name, gymName, member?.expiryDate || 'soon']),
      };

    // payment_due(en): "Hi {{1}}, this is a payment reminder from {{2}}. You have a
    //   pending balance of {{3}}. Please clear your dues at your earliest convenience."
    case 'payment': {
      const bal = member?.balanceFees ?? extra?.amount ?? 0;
      return {
        template: tpl('WA_TPL_PAYMENT', 'payment_due'),
        language: LANG,
        category: 'utility',
        components: bodyParams([name, gymName, money(bal)]),
      };
    }

    // class_reminder(en): "Hi {{1}}, we've missed you at {{2}}! Regular attendance
    //   keeps you on track — see you at your next session. Stay consistent!"
    case 'class':
      return {
        template: tpl('WA_TPL_CLASS', 'class_reminder'),
        language: LANG,
        // Meta classifies attendance/re-engagement reminders as Marketing.
        category: 'marketing',
        components: bodyParams([name, gymName]),
      };

    // announcement(en, MARKETING):
    //   "Hi {{1}}, here's an update from {{2}}:\n\n{{3}}\n\nThank you for being a valued member!"
    //   1=name, 2=gym name, 3=announcement message
    case 'announcement':
      return {
        template: tpl('WA_TPL_ANNOUNCEMENT', 'announcement'),
        language: LANG,
        category: 'marketing',
        components: bodyParams([name, gymName, extra?.body || '']),
      };

    default:
      throw new Error(`Unknown WhatsApp message type: ${type}`);
  }
}
