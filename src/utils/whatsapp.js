export function openWhatsApp(phone, message) {
  const number = String(phone).replace(/\D/g, '').slice(-10);
  window.open(`https://wa.me/91${number}?text=${encodeURIComponent(message)}`, '_blank');
}
