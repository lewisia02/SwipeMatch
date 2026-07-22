import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Shippori_Antique_B1 } from 'next/font/google';
import './globals.css';

export const metadata: Metadata = {
  title: 'SwipeMatch - 社内AIイベント ロゴ投票アプリ',
};

const display = Shippori_Antique_B1({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
});

const body = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-mono',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="text-body min-h-screen bg-paper font-sans text-text-base">{children}</body>
    </html>
  );
}
