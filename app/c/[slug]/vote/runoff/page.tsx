'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCompetition } from '@/app/c/[slug]/CompetitionContext';
import { Button } from '@/components/Button';
import { Counter } from '@/components/Counter';
import { SelectableGrid } from '@/components/SelectableGrid';
import { Toast } from '@/components/Toast';
import { markVoted } from '@/lib/client/voteSession';

const MAX_SELECTABLE = 1;

type LoadStatus = 'loading' | 'not_open' | 'not_eligible' | 'voted' | 'error' | 'ready';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

interface RunoffLogo {
  id: string;
  imageUrl: string;
  memo: string;
}

interface ToastState {
  message: string;
  variant: 'success' | 'error' | 'info';
}

export default function RunoffVotePage() {
  const router = useRouter();
  const { slug } = useCompetition();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [round, setRound] = useState<number | null>(null);
  const [logos, setLogos] = useState<RunoffLogo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [voteClosed, setVoteClosed] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStatusFromServer();
    return () => {
      cancelled = true;
    };

    async function loadStatusFromServer() {
      setLoadStatus('loading');
      try {
        const res = await fetch(`/api/c/${slug}/runoff`);
        if (!res.ok) {
          if (!cancelled) setLoadStatus('error');
          return;
        }
        const body: {
          round: number | null;
          logos: RunoffLogo[];
          eligible: boolean;
          alreadyVoted: boolean;
        } = await res.json();
        if (cancelled) return;

        if (body.round === null) {
          setLoadStatus('not_open');
        } else if (!body.eligible) {
          setLoadStatus('not_eligible');
        } else if (body.alreadyVoted) {
          setLoadStatus('voted');
        } else {
          setRound(body.round);
          setLogos(body.logos);
          setLoadStatus('ready');
        }
      } catch {
        if (!cancelled) setLoadStatus('error');
      }
    }
  }, [slug]);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.variant === 'info' ? 500 : 2000;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleToggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? [] : [id]));
  }

  function handleLimitReached() {
    setToast({ message: '1つだけ選択できます', variant: 'info' });
  }

  async function handleSubmit() {
    if (round === null) return;
    setSubmitStatus('submitting');
    try {
      const res = await fetch(`/api/c/${slug}/votes/runoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoId: selected[0] }),
      });

      if (!res.ok) {
        const body: { message?: string } = await res.json().catch(() => ({}));
        setSubmitStatus('error');
        if (res.status === 409 || res.status === 403) {
          setVoteClosed(true);
        }
        setToast({
          message: body.message ?? 'エラーが発生しました。時間をおいて再度お試しください',
          variant: 'error',
        });
        return;
      }

      setSubmitStatus('success');
      markVoted(slug, round);
      setToast({ message: '投票ありがとうございました', variant: 'success' });
      setTimeout(() => router.push(`/c/${slug}`), 2000);
    } catch {
      setSubmitStatus('error');
      setToast({ message: 'エラーが発生しました。時間をおいて再度お試しください', variant: 'error' });
    }
  }

  const isGridDisabled = submitStatus === 'submitting' || submitStatus === 'success' || voteClosed;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={`/c/${slug}`} className="text-caption text-primary underline">
          ← トップへ戻る
        </Link>
        <h1 className="text-h2">ランオフ投票（1つだけ選択）</h1>
      </div>

      {loadStatus === 'loading' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-md bg-bg-muted" />
          ))}
        </div>
      )}

      {loadStatus === 'not_open' && (
        <p className="text-body text-text-muted">
          現在ランオフの投票受付中ではありません。会場の画面をご確認ください
        </p>
      )}

      {loadStatus === 'not_eligible' && (
        <p className="text-body text-text-muted">
          通常の決選投票をしていないため、ランオフには参加できません
        </p>
      )}

      {loadStatus === 'voted' && (
        <p className="text-body text-text-muted">
          投票ありがとうございました。結果発表をお楽しみに🎉
        </p>
      )}

      {loadStatus === 'error' && (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-body text-danger">読み込みに失敗しました</p>
          <Button type="button" onClick={() => window.location.reload()}>
            再試行
          </Button>
        </div>
      )}

      {loadStatus === 'ready' && (
        <>
          <SelectableGrid
            items={logos}
            selected={selected}
            maxSelectable={MAX_SELECTABLE}
            disabled={isGridDisabled}
            onToggle={handleToggle}
            onLimitReached={handleLimitReached}
          />
          <div className="flex flex-col gap-3">
            <Counter current={selected.length} max={MAX_SELECTABLE} />
            {selected.length === 0 && !isGridDisabled && (
              <p className="text-caption text-text-muted">1つ選択してください</p>
            )}
            <Button
              type="button"
              loading={submitStatus === 'submitting'}
              disabled={selected.length === 0 || isGridDisabled}
              onClick={handleSubmit}
            >
              投票する
            </Button>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} variant={toast.variant} />}
    </main>
  );
}
