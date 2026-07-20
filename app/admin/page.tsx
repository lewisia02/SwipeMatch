'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { Toast } from '@/components/Toast';
import type { EventPhase } from '@/lib/types/AppSettings';

const PHASE_ORDER: EventPhase[] = ['submission', 'voting', 'results'];

const PHASE_LABELS: Record<EventPhase, string> = {
  submission: '投稿受付中',
  voting: '投票中',
  results: '結果発表中',
};

const PHASE_BUTTON_LABELS: Record<EventPhase, string> = {
  submission: '投稿受付開始',
  voting: '投票開始',
  results: '結果発表',
};

const PHASE_CONFIRM_MESSAGES: Record<EventPhase, string> = {
  submission: '投稿受付フェーズに切り替えます。よろしいですか？',
  voting: '投票フェーズに切り替えます。投稿は締め切られます。よろしいですか？',
  results: '結果発表フェーズに切り替えます。投票は締め切られます。よろしいですか？',
};

type LoadStatus = 'loading' | 'loaded' | 'error';

interface ToastState {
  message: string;
  variant: 'success' | 'error' | 'info';
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [phase, setPhase] = useState<EventPhase | null>(null);
  const [confirmingPhase, setConfirmingPhase] = useState<EventPhase | null>(null);
  const [switching, setSwitching] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appUrl, setAppUrl] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPhase();
    return () => {
      cancelled = true;
    };

    async function loadPhase() {
      setLoadStatus('loading');
      try {
        const res = await fetch('/api/phase');
        if (!res.ok) {
          if (!cancelled) setLoadStatus('error');
          return;
        }
        const body: { phase: EventPhase } = await res.json();
        if (cancelled) return;
        setPhase(body.phase);
        setLoadStatus('loaded');
      } catch {
        if (!cancelled) setLoadStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleConfirmSwitch() {
    if (!confirmingPhase) return;
    const targetPhase = confirmingPhase;
    setConfirmingPhase(null);
    setSwitching(true);

    try {
      const res = await fetch('/api/admin/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: targetPhase }),
      });

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

      setPhase(targetPhase);
      setToast({ message: 'フェーズを切り替えました', variant: 'success' });
    } catch {
      setToast({
        message: 'エラーが発生しました。時間をおいて再度お試しください',
        variant: 'error',
      });
    } finally {
      setSwitching(false);
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/results/export');

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

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'results.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setToast({
        message: 'エラーが発生しました。時間をおいて再度お試しください',
        variant: 'error',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <main
        inert={confirmingPhase ? true : undefined}
        className="mx-auto flex max-w-3xl flex-col gap-6 p-6"
      >
        <h1 className="text-h1">管理者ダッシュボード</h1>

        <div className="flex items-center gap-3">
          <span className="text-body">現在のフェーズ:</span>
          {loadStatus === 'loading' ? (
            <div className="h-6 w-24 animate-pulse rounded-full bg-bg-muted" />
          ) : loadStatus === 'error' ? (
            <p className="text-caption text-danger">フェーズの取得に失敗しました</p>
          ) : (
            phase && <Badge>{PHASE_LABELS[phase]}</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {PHASE_ORDER.map((targetPhase) => {
            const isDisabled =
              loadStatus !== 'loaded' ||
              !phase ||
              PHASE_ORDER.indexOf(targetPhase) <= PHASE_ORDER.indexOf(phase) ||
              switching;
            const isCurrent = phase === targetPhase;
            return (
              <Button
                key={targetPhase}
                type="button"
                variant="secondary"
                disabled={isDisabled}
                onClick={() => setConfirmingPhase(targetPhase)}
              >
                {isCurrent && '✓ '}
                {PHASE_BUTTON_LABELS[targetPhase]}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-h2">アプリURL QRコード</h2>
          {appUrl && <QRCodeDisplay url={appUrl} />}
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/admin/results"
            className="rounded-md bg-primary px-4 py-3 text-center font-semibold text-white"
          >
            結果発表画面を開く
          </Link>
          <Button type="button" variant="secondary" loading={exporting} onClick={handleExportCsv}>
            結果ランキングをCSVでダウンロード
          </Button>
        </div>

        {toast && <Toast message={toast.message} variant={toast.variant} />}
      </main>

      {confirmingPhase && (
        <ConfirmDialog
          title="フェーズ切り替えの確認"
          message={PHASE_CONFIRM_MESSAGES[confirmingPhase]}
          onConfirm={handleConfirmSwitch}
          onCancel={() => setConfirmingPhase(null)}
        />
      )}
    </>
  );
}
