import { Router } from 'express';
import { listHistory, getHistoryEntry } from '../lib/historyStore.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const historyRouter = Router();

historyRouter.get('/', requireAuth, (req, res) => {
  res.json({ history: listHistory() });
});

historyRouter.get('/:id', requireAuth, (req, res) => {
  const entry = getHistoryEntry(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'not_found', message: 'History entry not found' });
  }
  res.json({ entry });
});
