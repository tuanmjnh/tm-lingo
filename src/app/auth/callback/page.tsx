'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hashRaw = window.location.hash ? window.location.hash.slice(1) : '';
    const hash = new URLSearchParams(hashRaw);
    const payload = {
      type: 'SUPABASE_OAUTH_CALLBACK',
      code: search.get('code') || null,
      accessToken: hash.get('access_token') || null,
      refreshToken: hash.get('refresh_token') || null,
      error:
        search.get('error_description') ||
        search.get('error') ||
        hash.get('error_description') ||
        hash.get('error') ||
        null,
    };
    if (window.opener) {
      window.opener.postMessage(payload, '*');
      window.close();
    } else {
      const next =
        '/?tab=parents' +
        (window.location.search ? '&' + window.location.search.slice(1) : '') +
        (window.location.hash || '');
      window.location.replace(next);
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="text-center p-6 max-w-xs">
        <strong className="text-base font-semibold">Completing sign-in…</strong>
        <p className="mt-2 text-sm text-slate-600">
          This window will close automatically.
        </p>
      </div>
    </div>
  );
}
