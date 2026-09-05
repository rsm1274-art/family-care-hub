import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import type { HealthResponse } from '@familycarehub/shared-types';
import { requireAuth } from './auth';
import { config } from './config';
import { runMigrations } from './migrate';
import { prisma } from './prisma';
import { authRouter } from './routes/auth';
import { backupRouter } from './routes/backup';
import { documentsRouter } from './routes/documents';
import { imagesRouter } from './routes/images';
import { medicationsRouter } from './routes/medications';
import { peopleRouter } from './routes/people';

const app = express();

app.use(cors());
// Generous limit: legacy backups and label photos arrive as base64 JSON.
app.use(express.json({ limit: '100mb' }));

// The server only ever listens on loopback; rate limiting here just blunts
// credential guessing from other processes/logins on the same machine.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 });

app.get('/api/health', (_req, res) => {
  const body: HealthResponse = { status: 'ok', app: 'family-care-hub', version: config.appVersion };
  res.json(body);
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/people', requireAuth, peopleRouter);
app.use('/api/medications', requireAuth, medicationsRouter);
app.use('/api/documents', requireAuth, documentsRouter);
app.use('/api/images', requireAuth, imagesRouter);
app.use('/api/backup', requireAuth, backupRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await prisma.$connect();
  // Set by the Electron host: apply schema migrations without the Prisma CLI.
  if (process.env.RUN_MIGRATIONS === '1') {
    await runMigrations();
  }
  app.listen(config.port, config.host, () => {
    // The Electron main process watches for this exact line to know the API is up.
    console.log(`family-care-hub API listening on http://${config.host}:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
