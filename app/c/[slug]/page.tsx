'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCompetition } from '@/app/c/[slug]/CompetitionContext';
import type { EventPhase } from '@/lib/types/Competition';

type PhaseCheckStatus = 'loading' | 'loaded' | 'unknown';

export default function CompetitionTopPage() {
  const { slug, title } = useCompetition();
  const [phaseCheckStatus, setPhaseCheckStatus] = useState<PhaseCheckStatus>('loading');
  const [phase, setPhase] = useState<EventPhase | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/c/${slug}/phase`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('フェーズの取得に失敗しました');
        }
        return res.json();
      })
      .then((body: { phase: EventPhase }) => {
        if (!cancelled) {
          setPhase(body.phase);
          setPhaseCheckStatus('loaded');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhaseCheckStatus('unknown');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // loading中・取得失敗時は両ボタンを活性のままにする（遷移先で個別にフェーズチェックされるため）
  const isSubmissionOpen = phaseCheckStatus !== 'loaded' || phase === 'submission';
  const isVotingOpen = phaseCheckStatus !== 'loaded' || phase !== 'submission';

  if (phaseCheckStatus === 'loading') {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
        <h1 className="text-h1">🏆 {title}</h1>
        <p className="text-body text-text-muted">
          ロゴ作成大会に参加したみなさんのロゴを投稿・投票して優勝作品を決めましょう。
        </p>
        <div className="h-12 animate-pulse rounded-md bg-bg-muted" />
        <div className="h-12 animate-pulse rounded-md bg-bg-muted" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-h1">🏆 {title}</h1>
      <p className="text-body text-text-muted">
        ロゴ作成大会に参加したみなさんのロゴを投稿・投票して優勝作品を決めましょう。
      </p>

      {phaseCheckStatus === 'unknown' && (
        <p className="text-caption text-danger">
          フェーズの取得に失敗しました。時間をおいて再度お試しください
        </p>
      )}

      {isSubmissionOpen ? (
        <Link
          href={`/c/${slug}/upload`}
          className="rounded-md bg-primary px-4 py-3 text-center font-semibold text-white"
        >
          📤 画像を投稿する
        </Link>
      ) : (
        <span className="rounded-md bg-primary/50 px-4 py-3 text-center font-semibold text-white">
          📤 画像を投稿する（受付終了）
        </span>
      )}

      {isVotingOpen ? (
        <Link
          href={`/c/${slug}/vote/swipe`}
          className="rounded-md bg-secondary px-4 py-3 text-center font-semibold text-white"
        >
          🗳 投票へ進む
        </Link>
      ) : (
        <span className="rounded-md bg-secondary/50 px-4 py-3 text-center font-semibold text-white">
          🗳 投票へ進む（準備中）
        </span>
      )}
    </main>
  );
}
