import express from 'express';
import cors from 'cors';
import { config } from './lib/config.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { playlistsRouter } from './routes/playlists.js';
import { analysisRouter } from './routes/analysis.js';
import { plansRouter } from './routes/plans.js';
import { historyRouter } from './routes/history.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/playlists', playlistsRouter);
  app.use('/api/analysis', analysisRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/history', historyRouter);

  app.use(errorHandler);

  return app;
}
