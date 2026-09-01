import { getItems, setItems } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  let items;
  try {
    items = await getItems();
  } catch (err) {
    return res.status(500).json({ error: 'failed to load items' });
  }
  const idx = items.findIndex((i) => i.id === id);

  if (req.method === 'PUT') {
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    const { type, title, subject, deadline, description, addedBy } = req.body || {};
    const deadlineChanged = deadline && deadline !== items[idx].deadline;
    items[idx] = {
      ...items[idx],
      type: type ?? items[idx].type,
      title: title ?? items[idx].title,
      subject: subject ?? items[idx].subject,
      deadline: deadline ?? items[idx].deadline,
      description: description ?? items[idx].description,
      addedBy: addedBy ?? items[idx].addedBy,
      notified24: deadlineChanged ? false : items[idx].notified24,
      notified1: deadlineChanged ? false : items[idx].notified1,
    };
    try {
      await setItems(items);
      return res.status(200).json(items[idx]);
    } catch (err) {
      return res.status(500).json({ error: 'failed to save item' });
    }
  }

  if (req.method === 'DELETE') {
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    const [removed] = items.splice(idx, 1);
    try {
      await setItems(items);
      return res.status(200).json(removed);
    } catch (err) {
      return res.status(500).json({ error: 'failed to delete item' });
    }
  }

  res.setHeader('Allow', ['PUT', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
