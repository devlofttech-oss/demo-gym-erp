// Helpers for turning a rendered QR <svg> into a branded PNG and sharing it.

// Render a QR <svg> element to a branded PNG Blob (QR + name + gym caption).
export function qrSvgToPngBlob(svg, { name = '', caption = '' } = {}) {
  return new Promise((resolve, reject) => {
    if (!svg) { reject(new Error('QR not ready')); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const qrSize = 220;
    const padding = 24;
    const textHeight = 52;
    const canvas = document.createElement('canvas');
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2 + textHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, qrSize, qrSize);
      ctx.fillStyle = '#1e1b4b';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name || '', canvas.width / 2, qrSize + padding + 22);
      ctx.fillStyle = '#7c3aed';
      ctx.font = '11px sans-serif';
      ctx.fillText((caption || 'KILOS').toUpperCase(), canvas.width / 2, qrSize + padding + 42);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to render QR')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load QR')); };
    img.src = url;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Normalise an Indian phone number for wa.me (prepend 91 to bare 10-digit numbers).
function waNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

// Build the public QR download page URL for a member.
export function memberQrPageUrl(memberId, { name = '', gymName = '' } = {}) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (gymName) params.set('gym', gymName);
  return `${base}/qr/${memberId}?${params.toString()}`;
}

// Open WhatsApp with a pre-written message that contains the member's QR
// download link. No file download, no clipboard — just a clean link share.
export function shareQrOnWhatsApp(memberId, { name = '', phone = '', gymName = '' } = {}) {
  const link = memberQrPageUrl(memberId, { name, gymName });
  const text = `Hi ${name || 'there'}! 👋\nHere's your check-in QR code for *${gymName || 'our gym'}*.\n\nTap the link to download your QR:\n${link}\n\nShow it at the entrance to check in. 💪`;
  const num = waNumber(phone);
  const waUrl = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}
