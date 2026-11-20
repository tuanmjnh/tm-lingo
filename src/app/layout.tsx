import type { Metadata, Viewport } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: 'TM-Lingo',
  description:
    'Multilingual language-learning platform for children aged 3-5 with decoupled learning content, hybrid experience modes, multilingual story reader, and parent controls.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'TM-Lingo',
    description:
      'Multilingual language-learning platform for children aged 3-5 with decoupled learning content, hybrid experience modes, multilingual story reader, and parent controls.',
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
    <html lang="vi">
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
      <body className="bg-[#F8FAFC] text-[#0F172A] antialiased">
        {children}
      </body>
    </html>
  );
}
