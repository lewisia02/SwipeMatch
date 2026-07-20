'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Counter } from '@/components/Counter';
import { SelectableGrid } from '@/components/SelectableGrid';
import { Toast } from '@/components/Toast';
import { SwipeSessionManager } from '@/lib/client/SwipeSessionManager';
import type { Logo } from '@/lib/types/Logo';

const MAX_SELECTABLE = 3;

type LoadStatus = 'loading' | 'empty' | 'error' | 'ready';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

interface ToastState {
  message: string;
  variant: 'success' | 'error' | 'info';
}

export default function FinalVotePage() {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [keptLogos, setKeptLogos] = useState<Logo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [voteClosed, setVoteClosed] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadKeptLogos();
    return () => {
      cancelled = true;
    };

    async function loadKeptLogos() {
      setLoadStatus('loading');
      try {
        const res = await fetch('/api/logos');
        if (!res.ok) {
          if (!cancelled) setLoadStatus('error');
          return;
        }
        const body: { logos: Pick<Logo, 'id' | 'imageUrl' | 'memo'>[] } = await res.json();
        if (cancelled) return;

        const logos = body.logos.map((logo) => ({ ...logo, uploaderName: '', createdAt: new Date() }));
        const manager = new SwipeSessionManager(logos);
        const kept = manager.getKeptLogos();

        setKeptLogos(kept);
        setLoadStatus(kept.length === 0 ? 'empty' : 'ready');
      } catch {
        if (!cancelled) setLoadStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.variant === 'info' ? 500 : 2000;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (submitStatus !== 'success') return;
    const timer = setTimeout(() => router.push('/'), 1500);
    return () => clearTimeout(timer);
  }, [submitStatus, router]);

  function handleToggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id],
    );
  }

  function handleLimitReached() {
    setToast({ message: '最大3つまで選択できます', variant: 'info' });
  }

  async function handleSubmit() {
    setSubmitStatus('submitting');
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoIds: selected }),
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
      setToast({ message: '投票ありがとうございました', variant: 'success' });
    } catch {
      setSubmitStatus('error');
      setToast({ message: 'エラーが発生しました。時間をおいて再度お試しください', variant: 'error' });
    }
  }

  const isGridDisabled = submitStatus === 'submitting' || submitStatus === 'success' || voteClosed;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/vote/swipe" className="text-caption text-primary underline">
          ← 戻る
        </Link>
        <h1 className="text-h2">決選投票（最大3つまで選択）</h1>
      </div>

      {loadStatus === 'loading' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-md bg-bg-muted" />
          ))}
        </div>
      )}

      {loadStatus === 'empty' && (
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-body text-text-muted">キープした作品がありません</p>
          <Link href="/vote/swipe" className="text-caption text-primary underline">
            1次選考へ戻る
          </Link>
        </div>
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
            items={keptLogos}
            selected={selected}
            maxSelectable={MAX_SELECTABLE}
            disabled={isGridDisabled}
            onToggle={handleToggle}
            onLimitReached={handleLimitReached}
          />
          <div className="flex flex-col gap-3">
            <Counter current={selected.length} max={MAX_SELECTABLE} />
            {selected.length === 0 && !isGridDisabled && (
              <p className="text-caption text-text-muted">1つ以上選択してください</p>
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
