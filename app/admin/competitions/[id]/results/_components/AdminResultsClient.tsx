'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatedRankingList } from '@/components/AnimatedRankingList';
import { Button } from '@/components/Button';
import { RankingList } from '@/components/RankingList';
import { VoteTimelapseChart } from '@/components/VoteTimelapseChart';
import type { RankedLogo } from '@/lib/types/RankedLogo';

type LoadStatus = 'loading' | 'empty' | 'error' | 'ready' | 'timelapse' | 'playing' | 'revealed';

interface VoteTimelineEntry {
  logoId: string;
  votedAt: string;
}

interface AdminResultsClientProps {
  id: string;
  title: string;
}

export function AdminResultsClient({ id, title }: AdminResultsClientProps) {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [results, setResults] = useState<RankedLogo[]>([]);
  const [timeline, setTimeline] = useState<VoteTimelineEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadResults();
    return () => {
      cancelled = true;
    };

    async function loadResults() {
      setLoadStatus('loading');
      try {
        const [resultsRes, timelineRes] = await Promise.all([
          fetch(`/api/admin/competitions/${id}/results`),
          fetch(`/api/admin/competitions/${id}/results/timeline`),
        ]);

        if (resultsRes.status === 401 || timelineRes.status === 401) {
          if (!cancelled) {
            router.push(
              `/admin/login?message=${encodeURIComponent('セッションの有効期限が切れました。再度ログインしてください')}`,
            );
          }
          return;
        }

        if (!resultsRes.ok) {
          const body: { message?: string } = await resultsRes.json().catch(() => ({}));
          if (!cancelled) {
            setErrorMessage(body.message ?? '結果発表はまだ準備中です');
            setLoadStatus('error');
          }
          return;
        }

        const body: { results: RankedLogo[] } = await resultsRes.json();
        const timelineBody: { timeline: VoteTimelineEntry[] } = timelineRes.ok
          ? await timelineRes.json()
          : { timeline: [] };
        if (cancelled) return;

        setResults(body.results);
        setTimeline(timelineBody.timeline);
        setLoadStatus(body.results.length === 0 ? 'empty' : 'ready');
      } catch {
        if (!cancelled) {
          setErrorMessage('エラーが発生しました。時間をおいて再度お試しください');
          setLoadStatus('error');
        }
      }
    }
  }, [id, router]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h1">{title} 結果発表</h1>
        {loadStatus === 'ready' && (
          <Button
            type="button"
            onClick={() => setLoadStatus(timeline.length === 0 ? 'playing' : 'timelapse')}
          >
            発表開始
          </Button>
        )}
      </div>

      {loadStatus === 'loading' && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-md bg-bg-muted" />
          ))}
        </div>
      )}

      {loadStatus === 'empty' && <p className="text-body text-text-muted">まだ投票がありません</p>}

      {loadStatus === 'error' && <p className="text-body text-danger">{errorMessage}</p>}

      {loadStatus === 'ready' && <RankingList items={results} />}

      {loadStatus === 'timelapse' && (
        <VoteTimelapseChart
          logos={results}
          timeline={timeline}
          isPlaying={loadStatus === 'timelapse'}
          onComplete={() => setLoadStatus('playing')}
        />
      )}

      {(loadStatus === 'playing' || loadStatus === 'revealed') && (
        <AnimatedRankingList
          items={results}
          isPlaying={loadStatus === 'playing'}
          onComplete={() => setLoadStatus('revealed')}
        />
      )}
    </main>
  );
}
