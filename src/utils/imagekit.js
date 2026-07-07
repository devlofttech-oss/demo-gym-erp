async function compressImage(file) {
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });
}

export async function uploadGymLogo(file) {
  const compressed = await compressImage(file);

  const authRes = await fetch('/api/imagekit-auth');
  if (!authRes.ok) throw new Error('Failed to get upload token');
  const { token, expire, signature } = await authRes.json();

  const formData = new FormData();
  formData.append('file', compressed, `gym-logo-${Date.now()}.jpg`);
  formData.append('fileName', `gym-logo-${Date.now()}.jpg`);
  formData.append('publicKey', import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY);
  formData.append('signature', signature);
  formData.append('expire', String(expire));
  formData.append('token', token);
  formData.append('folder', '/gym-erp/logos');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'ImageKit upload failed');
  }

  const data = await res.json();
  return data.url;
}
