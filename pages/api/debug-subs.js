import { getSubscriptions } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  try {
    const subs = await getSubscriptions();

    const subscriptions = subs.map((sub, index) => {
      let provider = 'unknown';
      try {
        provider = new URL(sub.endpoint).hostname;
      } catch (e) {}

      return {
        index: index + 1,
        endpoint: sub.endpoint,
        provider,
        expirationTime: sub.expirationTime ?? null,
        hasP256dh: !!sub.keys?.p256dh,
        hasAuth: !!sub.keys?.auth,
      };
    });

    return res.status(200).json({
      ok: true,
      count: subs.length,
      subscriptions,
    });
  } catch (err) {
    return res.status(500).json({ error: 'failed to load subscriptions' });
  }
}
