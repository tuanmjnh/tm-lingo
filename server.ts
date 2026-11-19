import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { env } from './server/config/env.ts';
import { connectMongo } from './server/db/mongo.ts';
import { ensureSeededAdminAccount } from './server/auth/roleStore.ts';
import { createV1Router } from './server/api/v1Router.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = env.PORT;
  const isProd = env.NODE_ENV === 'production';

  // Warm up MongoDB and seed the initial system admin account non-blockingly
  void connectMongo().then(() => ensureSeededAdminAccount());

  app.use(express.json({ limit: '1mb' }));

  // Mount TM-Lingo modular API routes
  app.use('/api/v1', createV1Router());

  // Lightweight OAuth callback page for popup-based Supabase Google Sign-In
  app.get(['/auth/callback', '/auth/callback/'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TM-Lingo Sign-In</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F8FAFC; color: #0F172A; }
      .box { text-align: center; padding: 24px; max-width: 340px; }
      p { margin: 8px 0 0; font-size: 14px; color: #475569; }
    </style>
  </head>
  <body>
    <div class="box">
      <strong>Completing sign-in…</strong>
      <p>This window will close automatically.</p>
    </div>
    <script>
      (function () {
        var search = new URLSearchParams(window.location.search);
        var hashRaw = window.location.hash ? window.location.hash.slice(1) : '';
        var hash = new URLSearchParams(hashRaw);
        var payload = {
          type: 'SUPABASE_OAUTH_CALLBACK',
          code: search.get('code') || null,
          accessToken: hash.get('access_token') || null,
          refreshToken: hash.get('refresh_token') || null,
          error: search.get('error_description') || search.get('error') || hash.get('error_description') || hash.get('error') || null
        };
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          window.close();
        } else {
          var next = '/?tab=parents' + (window.location.search ? '&' + window.location.search.slice(1) : '') + (window.location.hash || '');
          window.location.replace(next);
        }
      })();
    </script>
  </body>
</html>`);
  });

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
