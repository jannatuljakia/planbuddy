import webpush from 'web-push';
import { getItems, setItems, getSubscriptions, removeSubscription } from '../../lib/db';

export default async function handler(req, res) {
  // Vercel's own cron sends "Authorization: Bearer <CRON_SECRET>".
  // External schedulers (recommended for anything more frequent than daily,
  // since Vercel's Hobby plan only allows once-per-day crons) can instead
  // pass ?secret=<CRON_SECRET> in the URL.
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
  let sentCount = 0;
  let changed = false;

  for (const item of items) {
    const deadline = new Date(item.deadline);
    const hoursLeft = (deadline - now) / 36e5;
    if (hoursLeft <= 0) continue;

    let stage = null;
    if (hoursLeft <= 1 && !item.notified1) stage = '1h';
    else if (hoursLeft <= 24 && !item.notified24) stage = '24h';
    if (!stage) continue;

    const payload = JSON.stringify({
      title: `⏰ ${item.title}`,
      body:
        stage === '1h'
          ? 'এক ঘণ্টার মধ্যে ডেডলাইন!'
          : '২৪ ঘণ্টার মধ্যে ডেডলাইন আছে',
    });

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

    if (stage === '1h') item.notified1 = true;
    if (stage === '24h') item.notified24 = true;
    changed = true;
  }

  if (changed) {
    try {
      await setItems(items);
    } catch (err) {
      // notifications already sent; log-worthy but not fatal to the response
    }
  }

  return res.status(200).json({ ok: true, sent: sentCount });
}
