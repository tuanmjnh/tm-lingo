'use client';

import dynamic from 'next/dynamic';
import { AppLoadingScreen } from './AppLoadingScreen';
import { ErrorBoundary } from './ErrorBoundary';

type AppTab = 'home' | 'learn' | 'stories' | 'audiobooks' | 'parents' | 'admin';

const App = dynamic(() => import('../App').then((m) => m.App), {
  ssr: false,
  loading: () => <AppLoadingScreen variant="splash" phase="bundle" />,
});

export function SpaClientShell({ initialTab = 'home' }: { initialTab?: AppTab }) {
  return (
    <ErrorBoundary>
      <App initialTab={initialTab} />
    </ErrorBoundary>
  );
}
