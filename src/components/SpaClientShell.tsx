'use client';

import { Suspense } from 'react';
import { App } from '../App';
import { AppLoadingScreen } from './AppLoadingScreen';
import { ErrorBoundary } from './ErrorBoundary';

type AppTab = 'home' | 'learn' | 'stories' | 'audiobooks' | 'parents' | 'admin';

export function SpaClientShell({ initialTab = 'home' }: { initialTab?: AppTab }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<AppLoadingScreen />}>
        <App initialTab={initialTab} />
      </Suspense>
    </ErrorBoundary>
  );
}
