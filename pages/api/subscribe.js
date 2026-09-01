import { addSubscription } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ error: 'invalid subscription' });
  }
  try {
    await addSubscription(sub);
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'failed to save subscription' });
  }
}
