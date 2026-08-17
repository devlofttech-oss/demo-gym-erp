// Frontend-only helpers: human labels + an approximate preview of what each
// WhatsApp template will say. Keep the wording in sync with the actual approved
// templates (and with api/_lib/whatsappTemplates.js).

export const WHATSAPP_TYPE_LABELS = {
  renewal: 'Renewal reminder',
  payment: 'Payment reminder',
  class: 'Attendance reminder',
  announcement: 'Announcement',
};

// The message categories map to cost tiers (utility = cheap, marketing = higher).
export const WHATSAPP_TYPE_CATEGORY = {
  renewal: 'utility',
  payment: 'utility',
  class: 'marketing', // Meta classifies attendance/re-engagement as Marketing
  announcement: 'marketing',
};

// Returns an approximate preview string for display in the confirm modal.
// `sample` may include { name, gymName, expiryDate, amount, body }.
export function previewText(type, sample = {}) {
  const name = sample.name || 'there';
  const gymName = sample.gymName || 'our gym';
  switch (type) {
    case 'renewal':
      return `Hi ${name}, this is a reminder from ${gymName} that your membership expires on ${sample.expiryDate || '{date}'}. Please renew soon to keep training. Thank you!`;
    case 'payment':
      return `Hi ${name}, this is a payment reminder from ${gymName}. You have a pending balance of ${sample.amount || '₹{amount}'}. Please clear your dues at your earliest convenience.`;
    case 'class':
      return `Hi ${name}, we've missed you at ${gymName}! Regular attendance keeps you on track — see you at your next session. Stay consistent! 💪`;
    case 'announcement':
      return `Hi ${name}, here's an update from ${gymName}:\n\n${sample.body || '{your announcement}'}\n\nThank you for being a valued member!`;
    default:
      return '';
  }
}
