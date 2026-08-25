// Free click-to-chat: opens WhatsApp (wa.me) with a pre-filled message.
// Used for Marketing-category messages (class reminders + announcements) where
// we deliberately avoid the paid Cloud API. 1-to-1 only (opens one chat).
export function openWhatsApp(phone, message) {
  const number = String(phone).replace(/\D/g, '').slice(-10);
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  window.open(`https://wa.me/91${number}${text}`, '_blank');
}
