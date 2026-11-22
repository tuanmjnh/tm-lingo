'use client';

import { Suspense } from 'react';
import { App } from '../../App';
import { AppLoadingScreen } from '../../components/AppLoadingScreen';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function SpaAppPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoadingScreen />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
