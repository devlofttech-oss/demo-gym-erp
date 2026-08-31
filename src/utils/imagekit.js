async function compressImage(file) {
  const { default: imageCompression } = await import('browser-image-compression');
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 512,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });
}

export async function uploadToImageKit(file, { folder = '/gym-erp/uploads', prefix = 'upload' } = {}) {
  const compressed = await compressImage(file);
  const fileName = `${prefix}-${Date.now()}.jpg`;

  const authRes = await fetch('/api/imagekit-auth');
  if (!authRes.ok) throw new Error('Failed to get upload token');
  const { token, expire, signature } = await authRes.json();

  const formData = new FormData();
  formData.append('file', compressed, fileName);
  formData.append('fileName', fileName);
  formData.append('publicKey', import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY);
  formData.append('signature', signature);
  formData.append('expire', String(expire));
  formData.append('token', token);
  formData.append('folder', folder);

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

export function uploadGymLogo(file) {
  return uploadToImageKit(file, { folder: '/gym-erp/logos', prefix: 'gym-logo' });
}

export function uploadMemberPhoto(file) {
  return uploadToImageKit(file, { folder: '/gym-erp/members', prefix: 'member' });
}

export async function uploadMemberDocument(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `doc-${Date.now()}-${safeName}`;

  const authRes = await fetch('/api/imagekit-auth');
  if (!authRes.ok) throw new Error('Failed to get upload token');
  const { token, expire, signature } = await authRes.json();

  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('fileName', fileName);
  formData.append('publicKey', import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY);
  formData.append('signature', signature);
  formData.append('expire', String(expire));
  formData.append('token', token);
  formData.append('folder', '/gym-erp/documents');

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Document upload failed');
  }
  return (await res.json()).url;
}
