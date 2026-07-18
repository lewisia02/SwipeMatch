import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SwipeMatch - 社内AIイベント ロゴ投票アプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-body min-h-screen bg-white text-text-base">{children}</body>
    </html>
  );
}
