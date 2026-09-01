import { randomUUID } from 'crypto';
import { getItems, setItems } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const items = await getItems();
      return res.status(200).json(items);
    } catch (err) {
      return res.status(500).json({ error: 'failed to load items' });
    }
  }

  if (req.method === 'POST') {
    const { type, title, subject, deadline, description, addedBy } = req.body || {};
    if (!title || !deadline) {
      return res.status(400).json({ error: 'title and deadline are required' });
    }
    try {
      const items = await getItems();
      const newItem = {
        id: randomUUID(),
        type: type || 'task',
        title,
        subject: subject || '',
        deadline,
        description: description || '',
        addedBy: addedBy || '',
        createdAt: new Date().toISOString(),
        notified24: false,
        notified1: false,
        completedBy: [],
      };
      items.push(newItem);
      await setItems(items);
      return res.status(201).json(newItem);
    } catch (err) {
      return res.status(500).json({ error: 'failed to save item' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
