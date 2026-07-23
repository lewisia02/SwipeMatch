'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCompetition } from '@/app/c/[slug]/CompetitionContext';
import { ColorBar } from '@/components/ColorBar';
import { usePhasePolling } from '@/lib/client/usePhasePolling';
import { hasVoted } from '@/lib/client/voteSession';
import { FINAL_VOTE_ROUND } from '@/lib/types/Vote';

function messageForVotedPhase(phase: string | null): string {
  if (phase === 'results') {
    return 'ただいま結果発表中です。会場の画面をご確認ください';
  }
  if (phase === 'ended') {
    return 'コンペは終了しました。ご参加ありがとうございました';
  }
  return '投票ありがとうございました。結果発表をお楽しみに🎉';
}

export default function CompetitionTopPage() {
  const { slug, title } = useCompetition();
  const { phase, runoffRound, status: phaseCheckStatus } = usePhasePolling(slug);
  const [voted, setVoted] = useState(false);
  const [votedRunoffRound, setVotedRunoffRound] = useState(false);

  useEffect(() => {
    setVoted(hasVoted(slug, FINAL_VOTE_ROUND));
  }, [slug]);

  useEffect(() => {
    if (phase === 'runoff' && runoffRound !== null) {
      setVotedRunoffRound(hasVoted(slug, runoffRound));
    }
  }, [slug, phase, runoffRound]);

  // loading中・取得失敗時は両ボタンを活性のままにする（遷移先で個別にフェーズチェックされるため）
  const isSubmissionOpen = phaseCheckStatus !== 'loaded' || phase === 'submission';
  const isVotingOpen = !voted && (phaseCheckStatus !== 'loaded' || phase === 'voting' || phase === 'results');
  const isRunoffOpen = phase === 'runoff' && runoffRound !== null && !votedRunoffRound;

  if (phaseCheckStatus === 'loading') {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
        <h1 className="font-display text-h1">{title}</h1>
        <ColorBar className="h-1 w-16 rounded-full" />
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
      <h1 className="font-display text-h1">{title}</h1>
      <ColorBar className="h-1 w-16 rounded-full" />
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
        <span className="rounded-md bg-bg-muted px-4 py-3 text-center font-semibold text-text-muted">
          📤 画像を投稿する（受付終了）
        </span>
      )}

      {phase === 'runoff' ? (
        isRunoffOpen ? (
          <Link
            href={`/c/${slug}/vote/runoff`}
            className="rounded-md bg-secondary px-4 py-3 text-center font-semibold text-white"
          >
            ⚖️ ランオフ投票へ進む
          </Link>
        ) : (
          <p className="rounded-md bg-bg-muted px-4 py-3 text-center text-text-muted">
            {runoffRound === null
              ? '同着があったため、ランオフを集計中です。会場の画面をご確認ください'
              : 'ランオフ投票ありがとうございました。結果発表をお楽しみに🎉'}
          </p>
        )
      ) : isVotingOpen ? (
        <Link
          href={`/c/${slug}/vote/swipe`}
          className="rounded-md bg-secondary px-4 py-3 text-center font-semibold text-white"
        >
          🗳 投票へ進む
        </Link>
      ) : voted ? (
        <p className="rounded-md bg-bg-muted px-4 py-3 text-center text-text-muted">
          {messageForVotedPhase(phase)}
        </p>
      ) : (
        <span className="rounded-md bg-bg-muted px-4 py-3 text-center font-semibold text-text-muted">
          🗳 投票へ進む（準備中）
        </span>
      )}
    </main>
  );
}
