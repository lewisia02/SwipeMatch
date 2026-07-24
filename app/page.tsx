import Link from 'next/link';
import { ColorBar } from '@/components/ColorBar';
import { createCompetitionService } from '@/lib/services/container';

// 開催中コンペは随時変わるため、ビルド時の静的プリレンダリングを避け常に実行時に評価する
export const dynamic = 'force-dynamic';

export default async function GlobalTopPage() {
  const competitionService = createCompetitionService();
  const active = await competitionService.findActive();

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <p className="font-mono text-caption uppercase tracking-widest text-text-muted">
        社内AIイベント
      </p>
      <h1 className="font-display text-h1 leading-none">ロゴ作成大会</h1>
      <ColorBar className="h-1.5 w-24 rounded-full" />

      {active ? (
        <Link
          href={`/c/${active.slug}`}
          className="rounded-md bg-primary px-4 py-3 text-center font-semibold text-white"
        >
          投票に参加する
        </Link>
      ) : (
        <p className="text-body text-text-muted">現在開催中のコンペはありません</p>
      )}

      <Link href="/how-to-use" className="text-caption text-text-muted underline">
        使い方はこちら
      </Link>

      <Link href="/admin" className="text-caption text-text-muted underline">
        管理者はこちら
      </Link>
    </main>
  );
}
