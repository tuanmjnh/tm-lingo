'use client';

import { Suspense } from 'react';
import { App } from '../../App';
import { AppLoadingScreen } from '../../components/AppLoadingScreen';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function AdminPortalPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <AppLoadingScreen
            label="TM-Lingo"
            subtitle="Đang mở không gian quản trị..."
          />
        }
      >
        <App initialTab="admin" />
      </Suspense>
    </ErrorBoundary>
  );
}
