import { NextResponse } from 'next/server';

const LEGACY_VITE_RECOVERY_SCRIPT = `
(async function recoverFromLegacyViteCache() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {}
  try {
    if (!sessionStorage.getItem('tm_lingo_vite_sw_recovered')) {
      sessionStorage.setItem('tm_lingo_vite_sw_recovered', '1');
      window.location.reload();
    }
  } catch (e) {
    window.location.reload();
  }
})();
`.trim();

export async function GET() {
  return new NextResponse(LEGACY_VITE_RECOVERY_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
