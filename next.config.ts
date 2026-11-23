import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function createNextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    reactStrictMode: true,
    outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_HUB_URL:
      process.env.NEXT_PUBLIC_HUB_URL ||
      process.env.VITE_PUBLIC_HUB_URL ||
      process.env.HUB_BASE_URL ||
      process.env.HUB_URL ||
      '',
    NEXT_PUBLIC_HUB_APP_ID:
      process.env.NEXT_PUBLIC_HUB_APP_ID ||
      process.env.VITE_PUBLIC_HUB_APP_ID ||
      process.env.HUB_APP_ID ||
      'tm-lingo',
    NEXT_PUBLIC_AUTH_PROVIDER:
      process.env.NEXT_PUBLIC_AUTH_PROVIDER ||
      process.env.AUTH_PROVIDER ||
      'hub',
    NEXT_PUBLIC_FIREBASE_VAPID_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
      process.env.VITE_FIREBASE_VAPID_KEY ||
      '',
  },
  async headers() {
    return [
      {
        source: '/(dev-sw|sw|push-sw).js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, max-age=0',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
  };
}
