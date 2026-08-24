import { setDocument } from '../firebase/db';

export async function publishReceipt(member, gymInfo) {
  const receiptId = member.id;
  await setDocument('receipts', receiptId, {
    gymName:       gymInfo.name     || '',
    gymAddress:    gymInfo.location || '',
    gymPhone:      gymInfo.contact  || '',
    gymLogoUrl:    gymInfo.logoUrl  || '',
    memberName:    member.name         || '',
    memberPhone:   member.phone        || '',
    membershipId:  member.membershipId || '',
    planName:      member.planName     || '',
    totalFees:     Number(member.totalFees   || 0),
    paidFees:      Number(member.paidFees    || 0),
    balanceFees:   Number(member.balanceFees || 0),
    planActiveFrom: member.planActiveFrom || '',
    expiryDate:    member.expiryDate || '',
    gstPercent:    Number(member.gstPercent || 0),
    generatedAt:   new Date().toISOString(),
  });
  return `${window.location.origin}/receipt/${receiptId}`;
}

function waNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

export function openReceiptWhatsApp(receiptUrl, member, gymInfo) {
  const text = `Hi ${member.name || 'there'}! 🏋️\nHere is your membership receipt from *${gymInfo.name || 'our gym'}*.\n\nView your receipt:\n${receiptUrl}\n\nThank you! 💪`;
  const num = waNumber(member.phone);
  const waUrl = num
    ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}
