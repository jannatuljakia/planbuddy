import webpush from 'web-push';
import { getItems, getSubscriptions, removeSubscription } from '../../lib/db';

export default async function handler(req, res) {
  // Same auth pattern as send-reminders: Vercel cron sends Authorization: Bearer <CRON_SECRET>,
  // external schedulers (recommended, since this should fire weekly) can use ?secret=<CRON_SECRET>.
  const authHeader = req.headers.authorization || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const providedSecret = bearerSecret || req.query.secret;

  if (process.env.CRON_SECRET && providedSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'VAPID keys are not configured' });
  }

  webpush.setVapidDetails(
    'mailto:reminders@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  let items, subs;
  try {
    items = await getItems();
    subs = await getSubscriptions();
  } catch (err) {
    return res.status(500).json({ error: 'failed to load data' });
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 36e5);

  const pending = items.filter((item) => {
    const isDone = (item.completedBy || []).length >= 2;
    return !isDone && new Date(item.deadline) <= weekAhead;
  });

  const overdueCount = pending.filter((i) => new Date(i.deadline) < now).length;
  const upcomingCount = pending.length - overdueCount;

  if (pending.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, message: 'nothing pending, no summary sent' });
  }

  let bodyLines = [];
  if (overdueCount > 0) bodyLines.push(`${overdueCount}টা বকেয়া`);
  if (upcomingCount > 0) bodyLines.push(`${upcomingCount}টা এই সপ্তাহে আসছে`);

  const payload = JSON.stringify({
    title: '📅 এই সপ্তাহের সামারি',
    body: bodyLines.join(', '),
  });

  let sentCount = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      sentCount++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeSubscription(sub.endpoint);
      }
    }
  }

  return res.status(200).json({ ok: true, sent: sentCount, pending: pending.length });
}
