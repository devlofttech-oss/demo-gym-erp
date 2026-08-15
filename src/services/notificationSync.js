import {
  getTenantCollection,
  getTenantDocument,
  setTenantDocument,
} from '../firebase/tenantDb';

const META_DOC = 'notification-meta';

function computeNotifications(members, payments) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const in7days = new Date(now); in7days.setDate(now.getDate() + 7); in7days.setHours(23, 59, 59, 999);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const notifs = [];

  members.forEach(m => {
    if (!m.expiryDate) return;
    const exp = new Date(m.expiryDate);
    const id = `exp-${m.id}-${m.expiryDate}`;
    if (exp >= now && exp <= in7days) {
      const diffDays = Math.ceil((exp - now) / 864e5);
      notifs.push({
        id, type: 'expiry', title: 'Expiring Soon',
        message: `${m.name}'s plan expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}.`,
        createdAt: new Date().toISOString(), link: `/members/${m.id}`,
      });
    } else if (exp < now && exp > new Date(now.getTime() - 7 * 864e5)) {
      const diffDays = Math.floor((now - exp) / 864e5);
      notifs.push({
        id, type: 'expired', title: 'Membership Expired',
        message: `${m.name}'s plan expired ${diffDays} day${diffDays !== 1 ? 's' : ''} ago.`,
        createdAt: new Date().toISOString(), link: `/members/${m.id}`,
      });
    }
  });

  payments.forEach(p => {
    if (!p.date) return;
    const pDate = new Date(p.date);
    if (pDate >= yesterday) {
      notifs.push({
        id: `pay-${p.id}`, type: 'payment', title: 'Payment Received',
        message: `₹${p.amount} from ${p.memberName || 'a member'}.`,
        createdAt: pDate.toISOString(), link: '/payments',
      });
    }
  });

  return notifs;
}

function pruneCreatedIds(createdIds) {
  // Remove IDs that can never trigger again:
  // - exp-{id}-{YYYY-MM-DD} where expiry is >7 days in the past
  const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 7);
  return createdIds.filter(id => {
    if (id.startsWith('exp-')) {
      // ID format: exp-{memberId}-YYYY-MM-DD (last 10 chars are the date)
      const dateStr = id.slice(-10);
      const d = new Date(dateStr);
      return isNaN(d.getTime()) || d >= cutoff;
    }
    // pay-{id}: keep — payment is uniquely identified, no need to expire
    return true;
  });
}

/**
 * Runs once per session. Detects new notification-worthy events and writes them
 * to the notifications collection. Already-created IDs (tracked in notification-meta)
 * are skipped so cleared notifications never come back.
 * Returns the count of docs now in the notifications collection.
 */
export async function syncNotifications(gymId) {
  if (!gymId) return 0;
  try {
    const [members, payments, metaDoc] = await Promise.all([
      getTenantCollection(gymId, 'members'),
      getTenantCollection(gymId, 'payments'),
      getTenantDocument(gymId, 'settings', META_DOC).catch(() => null),
    ]);

    const createdIds = new Set(metaDoc?.createdIds || []);
    const candidates = computeNotifications(members, payments);
    const fresh = candidates.filter(n => !createdIds.has(n.id));

    if (fresh.length > 0) {
      await Promise.all(fresh.map(n =>
        setTenantDocument(gymId, 'notifications', n.id, n)
      ));
      fresh.forEach(n => createdIds.add(n.id));
      const pruned = pruneCreatedIds([...createdIds]);
      await setTenantDocument(gymId, 'settings', META_DOC, { createdIds: pruned });
    }

    // Return live count from collection
    const live = await getTenantCollection(gymId, 'notifications');
    return live.length;
  } catch (e) {
    console.error('Notification sync error:', e);
    return 0;
  }
}
