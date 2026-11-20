'use client';

import { Suspense } from 'react';
import { App } from '../App';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function HomePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
            Loading TM-Lingo...
          </div>
        }
      >
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
