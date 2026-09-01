import { removeSubscription } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint required' });
  }
  try {
    await removeSubscription(endpoint);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'failed to remove subscription' });
  }
}
