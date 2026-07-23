'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { Toast } from '@/components/Toast';
import type { EventPhase } from '@/lib/types/Competition';

// 'runoff'は結果発表画面の専用操作（ランオフ開始・締切・再投票・同率優勝）からのみ遷移させ、
// この汎用フェーズ切替ボタン群には含めない（対象Logoのスナップショット作成を伴うため）
type ManualPhase = 'submission' | 'voting' | 'results' | 'ended';

const PHASE_ORDER: ManualPhase[] = ['submission', 'voting', 'results', 'ended'];

const PHASE_RANK: Record<EventPhase, number> = {
  submission: 0,
  voting: 1,
  results: 2,
  runoff: 3,
  ended: 4,
};

const PHASE_LABELS: Record<EventPhase, string> = {
  submission: '投稿受付中',
  voting: '投票中',
  results: '結果発表中',
  runoff: 'ランオフ実施中',
  ended: '終了',
};

const PHASE_BUTTON_LABELS: Record<ManualPhase, string> = {
  submission: '投稿受付開始',
  voting: '投票開始',
  results: '結果発表',
  ended: 'コンペを終了する',
};

const PHASE_CONFIRM_MESSAGES: Record<ManualPhase, string> = {
  submission: '投稿受付フェーズに切り替えます。よろしいですか？',
  voting: '投票フェーズに切り替えます。投稿は締め切られます。よろしいですか？',
  results: '結果発表フェーズに切り替えます。投票は締め切られます。よろしいですか？',
  ended: 'コンペを終了します。参加者は以後アクセスできなくなります。よろしいですか？',
};

interface ToastState {
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface DashboardSubmission {
  id: string;
  imageUrl: string;
  uploaderName: string;
  memo: string;
  createdAt: string;
}

interface DashboardStats {
  submissionCount: number;
  submissions: DashboardSubmission[];
  voterCount: number;
  totalVotes: number;
}

interface AdminCompetitionClientProps {
  id: string;
  slug: string;
  title: string;
  initialPhase: EventPhase;
}

export function AdminCompetitionClient({ id, slug, title, initialPhase }: AdminCompetitionClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<EventPhase>(initialPhase);
  const [confirmingPhase, setConfirmingPhase] = useState<ManualPhase | null>(null);
  const [switching, setSwitching] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appOrigin, setAppOrigin] = useState('');
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/competitions/${id}/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: DashboardStats | null) => {
        if (!cancelled && body) {
          setStats(body);
        }
      })
      .catch(() => {
        // 集計取得の失敗はフェーズ操作をブロックしないため、静かに無視する
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

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
      const res = await fetch(`/api/admin/competitions/${id}/phase`, {
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
      const res = await fetch(`/api/admin/competitions/${id}/results/export`);

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
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-caption text-text-muted">
            ← コンペ一覧
          </Link>
          <h1 className="text-h1">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-body">現在のフェーズ:</span>
          <Badge>{PHASE_LABELS[phase]}</Badge>
        </div>

        <div className="flex flex-wrap gap-3">
          {PHASE_ORDER.map((targetPhase) => {
            const isDisabled = PHASE_RANK[targetPhase] <= PHASE_RANK[phase] || switching;
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
          <h2 className="text-h2">コンペ専用URL QRコード</h2>
          {appOrigin && <QRCodeDisplay url={`${appOrigin}/c/${slug}`} />}
        </div>

        {stats && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-h2">投稿状況（{stats.submissionCount}件）</h2>
              {stats.submissions.length === 0 ? (
                <p className="text-body text-text-muted">まだ投稿がありません</p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-md">
                  <ul className="flex flex-col gap-2">
                    {stats.submissions.map((submission) => (
                      <li
                        key={submission.id}
                        className="flex items-center gap-3 rounded-md bg-bg-muted p-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={submission.imageUrl}
                          alt={submission.memo}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                        <div className="flex flex-col">
                          <span className="text-caption font-semibold">{submission.uploaderName}</span>
                          <span className="text-caption text-text-muted">{submission.memo}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-h2">投票状況</h2>
              <p className="text-body">
                投票済み人数: {stats.voterCount}人 / 総投票数: {stats.totalVotes}票
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href={`/admin/competitions/${id}/results`}
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
