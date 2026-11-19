import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './server/config/env.ts';
import { createV1Router } from './server/api/v1Router.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = env.PORT;
  const isProd = env.NODE_ENV === 'production';

  app.use(express.json({ limit: '1mb' }));

  // Mount TM-Lingo modular API routes
  app.use('/api/v1', createV1Router());

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TM-Lingo server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TM-Lingo server:', err);
  process.exit(1);
});
