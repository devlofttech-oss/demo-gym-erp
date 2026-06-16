const API_KEY = import.meta.env.VITE_FAST2SMS_API_KEY;

export async function sendSMS(phones, message) {
  if (!API_KEY) throw new Error('VITE_FAST2SMS_API_KEY is not set in .env');

  const numbers = phones
    .map(p => String(p).replace(/\D/g, '').slice(-10))
    .filter(p => p.length === 10)
    .join(',');

  if (!numbers) throw new Error('No valid phone numbers provided');

  const url = import.meta.env.DEV ? '/fast2sms/dev/bulkV2' : 'https://www.fast2sms.com/dev/bulkV2';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message,
      flash: '0',
      numbers,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.return === false) {
    throw new Error(data.message || 'SMS sending failed');
  }

  return data;
}
