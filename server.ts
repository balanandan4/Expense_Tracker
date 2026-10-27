import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { authRouter } from './src/server/authRoutes.ts';
import { financeRouter } from './src/server/financeRoutes.ts';
import { adminAndAiRouter } from './src/server/adminAndAiRoutes.ts';

dotenv.config();

// Ensure HMR WebSocket is disabled in the Cloud Run preview container
process.env.DISABLE_HMR = 'true';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Mount API routes
app.use('/api', authRouter);
app.use('/api', financeRouter);
app.use('/api', adminAndAiRouter);

async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ledger ETBA-2026] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
