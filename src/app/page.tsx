'use client';

import { Suspense } from 'react';
import { App } from '../App';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function HomePage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoadingScreen />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
