/**
 * Capacitor configuration for wrapping the hosted TM-Lingo Next.js 15 web app
 * into an Android APK/AAB without maintaining a second frontend codebase.
 *
 * See docs/superpowers/plans/2026-11-20-capacitor-android.md for build steps.
 */
interface TMLingoCapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url?: string;
    cleartext?: boolean;
    androidScheme?: 'https' | 'http';
    allowNavigation?: string[];
  };
  android?: {
    backgroundColor?: string;
    allowMixedContent?: boolean;
    captureInput?: boolean;
    webContentsDebuggingEnabled?: boolean;
  };
  plugins?: {
    SplashScreen?: {
      launchShowDuration?: number;
      backgroundColor?: string;
      showSpinner?: boolean;
    };
    StatusBar?: {
      style?: 'LIGHT' | 'DARK' | 'DEFAULT';
      backgroundColor?: string;
    };
  };
}

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.APP_BASE_URL ||
  'https://app.tm-lingo.app';

const config: TMLingoCapacitorConfig = {
  appId: 'app.tmlingo.mobile',
  appName: 'TM-Lingo',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: 'https',
    allowNavigation: [
      '*.firebaseapp.com',
      'accounts.google.com',
      '*.googleapis.com',
    ],
  },
  android: {
    backgroundColor: '#F8FAFC',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#F8FAFC',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0284C7',
    },
  },
};

export default config;
