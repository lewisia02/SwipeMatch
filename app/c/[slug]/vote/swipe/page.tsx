'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCompetition } from '@/app/c/[slug]/CompetitionContext';
import { ProgressBar } from '@/components/ProgressBar';
import { SwipeCard } from '@/components/SwipeCard';
import { SwipeSessionManager } from '@/lib/client/SwipeSessionManager';
import type { Logo } from '@/lib/types/Logo';

type LoadStatus = 'loading' | 'empty' | 'error' | 'success';

export default function SwipeScreeningPage() {
  const { slug } = useCompetition();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [manager, setManager] = useState<SwipeSessionManager | null>(null);
  // manager内部のミュータブルな状態(現在位置・決定)が変わるたびに再描画を促すためのカウンタ
  const [, forceRerender] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadLogos();
    return () => {
      cancelled = true;
    };

    async function loadLogos() {
      setLoadStatus('loading');
      try {
        const res = await fetch(`/api/c/${slug}/logos`);
        if (!res.ok) {
          if (!cancelled) setLoadStatus('error');
          return;
        }
        const body: { logos: Pick<Logo, 'id' | 'imageUrl' | 'memo'>[] } = await res.json();
        if (cancelled) return;

        if (body.logos.length === 0) {
          setLoadStatus('empty');
          return;
        }

        const logos = body.logos.map((logo) => ({
          ...logo,
          competitionId: '',
          uploaderName: '',
          createdAt: new Date(),
        }));
        setManager(new SwipeSessionManager(slug, logos));
        setLoadStatus('success');
      } catch {
        if (!cancelled) setLoadStatus('error');
      }
    }
  }, [slug]);

  const currentLogo = manager?.getCurrentLogo();
  const isComplete = manager?.isComplete() ?? false;
  const keptCount = manager?.getKeptLogos().length ?? 0;

  function handleSwipe(decision: 'keep' | 'skip') {
    if (!manager || !currentLogo) return;
    manager.recordDecision(currentLogo.id, decision);
    forceRerender((v) => v + 1);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h2">投票フェーズ</h1>
        {manager && <ProgressBar current={manager.getTotalCount() - manager.getRemainingCount()} total={manager.getTotalCount()} />}
      </div>

      {loadStatus === 'loading' && (
        <div className="aspect-square w-full animate-pulse rounded-md bg-bg-muted" />
      )}

      {loadStatus === 'empty' && (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-body text-text-muted">まだ投稿がありません</p>
          <Link href={`/c/${slug}`} className="text-caption text-primary underline">
            トップ画面へ戻る
          </Link>
        </div>
      )}

      {loadStatus === 'error' && (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-body text-danger">読み込みに失敗しました</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-white"
          >
            再試行
          </button>
        </div>
      )}

      {loadStatus === 'success' && manager && !isComplete && currentLogo && (
        <SwipeCard key={currentLogo.id} logo={currentLogo} onSwipe={handleSwipe} />
      )}

      {loadStatus === 'success' && isComplete && (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          {keptCount === 0 ? (
            <p className="text-caption text-text-muted">決選投票に進むには、1枚以上キープしてください</p>
          ) : (
            <p className="text-body">{keptCount}枚キープしました</p>
          )}
          {keptCount === 0 ? (
            <button
              type="button"
              disabled
              className="w-full rounded-md bg-primary/50 px-4 py-3 text-center font-semibold text-white"
            >
              決選投票へ
            </button>
          ) : (
            <Link
              href={`/c/${slug}/vote/final`}
              className="w-full rounded-md bg-primary px-4 py-3 text-center font-semibold text-white"
            >
              決選投票へ
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
