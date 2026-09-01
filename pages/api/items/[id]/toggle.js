import { getItems, setItems } from '../../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }

  try {
    const items = await getItems();
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });

    const item = items[idx];
    const completedBy = Array.isArray(item.completedBy) ? item.completedBy : [];
    const already = completedBy.includes(name);
    item.completedBy = already ? completedBy.filter((n) => n !== name) : [...completedBy, name];
    items[idx] = item;

    await setItems(items);
    return res.status(200).json(item);
  } catch (err) {
    return res.status(500).json({ error: 'failed to toggle completion' });
  }
}
