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

// Share the QR image on WhatsApp.
// - Mobile / browsers with Web Share + file support: opens the native share sheet
//   (pick WhatsApp + contact) with the actual QR image attached.
// - Otherwise: downloads the QR and opens a WhatsApp chat (to the member if the
//   phone is known) with a text note — wa.me can't attach images.
// Returns 'shared' | 'cancelled' | 'fallback'.
export async function shareQrOnWhatsApp(blob, { name = '', phone = '', gymName = '' } = {}) {
  const file = new File([blob], `${name || 'member'}-qr.png`, { type: 'image/png' });
  const text = `Hi ${name || 'there'}! Here's your ${gymName || 'gym'} check-in QR code. Show it at the entrance to check in. 💪`;

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${name || 'Member'} — Gym QR`, text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to fallback
    }
  }

  downloadBlob(blob, `${name || 'member'}-qr.png`);
  const num = waNumber(phone);
  const waUrl = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  return 'fallback';
}
