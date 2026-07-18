import Link from 'next/link';

export default function TopPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-h1">🏆 社内AIイベント ロゴ投票アプリ</h1>
      <p className="text-body text-text-muted">
        ロゴ作成大会に参加したみなさんのロゴを投稿・投票して優勝作品を決めましょう。
      </p>
      <Link
        href="/upload"
        className="rounded-md bg-primary px-4 py-3 text-center font-semibold text-white"
      >
        📤 画像を投稿する
      </Link>
    </main>
  );
}
