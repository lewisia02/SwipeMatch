'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AnimatedRankingList } from '@/components/AnimatedRankingList';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { RankingList } from '@/components/RankingList';
import { Toast } from '@/components/Toast';
import { VoteTimelapseChart } from '@/components/VoteTimelapseChart';
import type { EventPhase } from '@/lib/types/Competition';
import type { RankedLogo } from '@/lib/types/RankedLogo';

type LoadStatus = 'loading' | 'empty' | 'error' | 'ready' | 'timelapse' | 'playing' | 'revealed';

interface VoteTimelineEntry {
  logoId: string;
  votedAt: string;
  round: number;
}

interface ToastState {
  message: string;
  variant: 'success' | 'error' | 'info';
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
  const [phase, setPhase] = useState<EventPhase | null>(null);
  const [runoffRound, setRunoffRound] = useState<number | null>(null);
  const [runoffActionLoading, setRunoffActionLoading] = useState(false);
  const [isTimelapsePlaying, setIsTimelapsePlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadResults = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const [resultsRes, timelineRes] = await Promise.all([
        fetch(`/api/admin/competitions/${id}/results`),
        fetch(`/api/admin/competitions/${id}/results/timeline`),
      ]);

      if (resultsRes.status === 401 || timelineRes.status === 401) {
        router.push(
          `/admin/login?message=${encodeURIComponent('セッションの有効期限が切れました。再度ログインしてください')}`,
        );
        return;
      }

      if (!resultsRes.ok) {
        const body: { message?: string } = await resultsRes.json().catch(() => ({}));
        setErrorMessage(body.message ?? '結果発表はまだ準備中です');
        setLoadStatus('error');
        return;
      }

      const body: { results: RankedLogo[]; phase: EventPhase; runoffRound: number | null } =
        await resultsRes.json();
      const timelineBody: { timeline: VoteTimelineEntry[] } = timelineRes.ok
        ? await timelineRes.json()
        : { timeline: [] };

      setResults(body.results);
      setPhase(body.phase);
      setRunoffRound(body.runoffRound);
      setTimeline(timelineBody.timeline);
      setLoadStatus(body.results.length === 0 ? 'empty' : 'ready');
    } catch {
      setErrorMessage('エラーが発生しました。時間をおいて再度お試しください');
      setLoadStatus('error');
    }
  }, [id, router]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleRunoffAction(path: 'start' | 'close' | 'resolve') {
    setRunoffActionLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/${id}/runoff/${path}`, { method: 'POST' });

      if (res.status === 401) {
        router.push(
          `/admin/login?message=${encodeURIComponent('セッションの有効期限が切れました。再度ログインしてください')}`,
        );
        return;
      }

      if (!res.ok) {
        const body: { message?: string } = await res.json().catch(() => ({}));
        setToast({
          message: body.message ?? 'エラーが発生しました。時間をおいて再度お試しください',
          variant: 'error',
        });
        return;
      }

      setToast({ message: '操作が完了しました', variant: 'success' });
      await loadResults();
    } catch {
      setToast({ message: 'エラーが発生しました。時間をおいて再度お試しください', variant: 'error' });
    } finally {
      setRunoffActionLoading(false);
    }
  }

  const hasTie = results.some((logo) => logo.isTiedForRunoff);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-ink p-6 text-paper">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-h1">{title} 結果発表</h1>
        {loadStatus === 'ready' && (
          <Button
            type="button"
            onClick={() => {
              setIsTimelapsePlaying(false);
              setLoadStatus(timeline.length === 0 ? 'playing' : 'timelapse');
            }}
          >
            発表開始
          </Button>
        )}
      </div>

      {loadStatus === 'loading' && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-sm bg-paper/10" />
          ))}
        </div>
      )}

      {loadStatus === 'empty' && <p className="text-body text-paper/70">まだ投票がありません</p>}

      {loadStatus === 'error' && <p className="text-body text-danger">{errorMessage}</p>}

      {loadStatus === 'ready' && phase === 'results' && hasTie && (
        <div className="flex items-center gap-3 rounded-md bg-paper/10 p-4">
          <Badge variant="warning">同着があります</Badge>
          <Button type="button" loading={runoffActionLoading} onClick={() => handleRunoffAction('start')}>
            ランオフを開始
          </Button>
        </div>
      )}

      {loadStatus === 'ready' && phase === 'runoff' && runoffRound !== null && (
        <div className="flex items-center gap-3 rounded-md bg-paper/10 p-4">
          <Badge>ランオフ ラウンド{runoffRound} 投票受付中</Badge>
          <Button type="button" loading={runoffActionLoading} onClick={() => handleRunoffAction('close')}>
            ランオフを締め切る
          </Button>
        </div>
      )}

      {loadStatus === 'ready' && phase === 'runoff' && runoffRound === null && hasTie && (
        <div className="flex flex-col gap-3 rounded-md bg-paper/10 p-4">
          <Badge variant="warning">ランオフでも同着が続いています</Badge>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              loading={runoffActionLoading}
              onClick={() => handleRunoffAction('start')}
            >
              再投票する
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={runoffActionLoading}
              onClick={() => handleRunoffAction('resolve')}
            >
              同率優勝として確定する
            </Button>
          </div>
        </div>
      )}

      {loadStatus === 'ready' && <RankingList items={results} />}

      {loadStatus === 'timelapse' && (
        <div className="flex flex-col gap-4">
          <VoteTimelapseChart
            logos={results}
            timeline={timeline}
            isPlaying={isTimelapsePlaying}
            onComplete={() => setLoadStatus('playing')}
          />
          {!isTimelapsePlaying && (
            <div className="flex justify-center">
              <Button type="button" onClick={() => setIsTimelapsePlaying(true)}>
                結果発表
              </Button>
            </div>
          )}
        </div>
      )}

      {(loadStatus === 'playing' || loadStatus === 'revealed') && (
        <AnimatedRankingList
          items={results}
          isPlaying={loadStatus === 'playing'}
          onComplete={() => setLoadStatus('revealed')}
        />
      )}

      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </main>
  );
}
