import type { Metadata, Viewport } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: 'TM-Lingo',
  description:
    'Nền tảng học đa ngôn ngữ và đọc truyện tương tác theo lộ trình từng lứa tuổi từ Mầm non đến Lớp 12 dành cho gia đình.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'TM-Lingo',
    description:
      'Nền tảng học đa ngôn ngữ và đọc truyện tương tác theo lộ trình từng lứa tuổi từ Mầm non đến Lớp 12 dành cho gia đình.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TM-Lingo',
  },
};

export const viewport: Viewport = {
  themeColor: '#0284C7',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F6F8FB] text-[#0F172A] dark:bg-[#090E1A] dark:text-[#F1F5F9] antialiased">
        {children}
      </body>
    </html>
  );
}
