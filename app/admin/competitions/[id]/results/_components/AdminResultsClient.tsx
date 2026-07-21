'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatedRankingList } from '@/components/AnimatedRankingList';
import { Button } from '@/components/Button';
import { RankingList } from '@/components/RankingList';
import type { RankedLogo } from '@/lib/types/RankedLogo';

type LoadStatus = 'loading' | 'empty' | 'error' | 'ready' | 'playing' | 'revealed';

interface AdminResultsClientProps {
  id: string;
  title: string;
}

export function AdminResultsClient({ id, title }: AdminResultsClientProps) {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [results, setResults] = useState<RankedLogo[]>([]);
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
        const res = await fetch(`/api/admin/competitions/${id}/results`);

        if (res.status === 401) {
          if (!cancelled) {
            router.push(
              `/admin/login?message=${encodeURIComponent('セッションの有効期限が切れました。再度ログインしてください')}`,
            );
          }
          return;
        }

        if (!res.ok) {
          const body: { message?: string } = await res.json().catch(() => ({}));
          if (!cancelled) {
            setErrorMessage(body.message ?? '結果発表はまだ準備中です');
            setLoadStatus('error');
          }
          return;
        }

        const body: { results: RankedLogo[] } = await res.json();
        if (cancelled) return;

        setResults(body.results);
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
          <Button type="button" onClick={() => setLoadStatus('playing')}>
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
