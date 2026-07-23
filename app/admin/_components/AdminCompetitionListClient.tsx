'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { CompetitionCard } from '@/components/CompetitionCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DeleteCompetitionDialog } from '@/components/DeleteCompetitionDialog';
import { Input } from '@/components/Input';
import { Toast } from '@/components/Toast';
import type { Competition } from '@/lib/types/Competition';

type LoadStatus = 'loading' | 'loaded' | 'error';

// この画面はコンペ一覧の表示・作成・終了・削除のみを扱い、ランオフの状態は関知しないため、
// Competitionドメイン型から`runoffRound`を除いたビュー用の型を使う
type CompetitionListItem = Omit<Competition, 'runoffRound'>;

interface ToastState {
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface CompetitionJson {
  id: string;
  slug: string;
  title: string;
  status: Competition['status'];
  currentPhase: Competition['currentPhase'];
  createdAt: string;
  closedAt: string | null;
}

function toCompetition(json: CompetitionJson): CompetitionListItem {
  return {
    ...json,
    createdAt: new Date(json.createdAt),
    closedAt: json.closedAt ? new Date(json.closedAt) : null,
  };
}

export function AdminCompetitionListClient() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appOrigin, setAppOrigin] = useState('');
  const [deletingCompetition, setDeletingCompetition] = useState<CompetitionListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    void loadCompetitions();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadCompetitions() {
    setLoadStatus('loading');
    try {
      const res = await fetch('/api/admin/competitions');
      if (!res.ok) {
        setLoadStatus('error');
        return;
      }
      const body: { competitions: CompetitionJson[] } = await res.json();
      setCompetitions(body.competitions.map(toCompetition));
      setLoadStatus('loaded');
    } catch {
      setLoadStatus('error');
    }
  }

  const activeCompetition = competitions.find((c) => c.status === 'active') ?? null;
  const pastCompetitions = competitions.filter((c) => c.status === 'closed');

  function handleActivateClick(event: React.FormEvent) {
    event.preventDefault();
    if (!title) {
      setTitleError('題名を入力してください');
      return;
    }
    setTitleError(null);

    if (activeCompetition) {
      setConfirming(true);
      return;
    }
    void activate();
  }

  async function activate() {
    setConfirming(false);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const body: { message?: string } = await res.json().catch(() => ({}));
        setToast({
          message: body.message ?? 'エラーが発生しました。時間をおいて再度お試しください',
          variant: 'error',
        });
        return;
      }

      setTitle('');
      setToast({ message: 'コンペを開催しました', variant: 'success' });
      await loadCompetitions();
    } catch {
      setToast({ message: 'エラーが発生しました。時間をおいて再度お試しください', variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingCompetition) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/competitions/${deletingCompetition.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: deletingCompetition.title }),
      });

      if (!res.ok) {
        const body: { message?: string } = await res.json().catch(() => ({}));
        setToast({
          message: body.message ?? 'エラーが発生しました。時間をおいて再度お試しください',
          variant: 'error',
        });
        return;
      }

      setDeletingCompetition(null);
      setToast({ message: 'コンペを削除しました', variant: 'success' });
      await loadCompetitions();
    } catch {
      setToast({ message: 'エラーが発生しました。時間をおいて再度お試しください', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <main
        inert={confirming || deletingCompetition ? true : undefined}
        className="mx-auto flex max-w-3xl flex-col gap-8 p-6"
      >
        <h1 className="font-display text-h1">管理者コンペ一覧</h1>

        <form onSubmit={handleActivateClick} className="flex flex-col gap-3">
          <h2 className="font-display text-h2">新しいコンペを開催する</h2>
          <Input
            id="title"
            label="題名"
            value={title}
            maxLength={100}
            error={titleError ?? undefined}
            onChange={(e) => setTitle(e.target.value)}
            disabled={creating}
            required
          />
          <Button type="submit" loading={creating}>
            開催する
          </Button>
        </form>

        <div className="flex flex-col gap-3">
          <h2 className="text-h2">開催中</h2>
          {loadStatus === 'loading' && (
            <div className="h-40 animate-pulse rounded-md bg-bg-muted" />
          )}
          {loadStatus === 'error' && (
            <p className="text-body text-danger">コンペ一覧の取得に失敗しました</p>
          )}
          {loadStatus === 'loaded' && !activeCompetition && (
            <p className="text-body text-text-muted">現在開催中のコンペはありません</p>
          )}
          {loadStatus === 'loaded' && activeCompetition && (
            <CompetitionCard {...activeCompetition} appOrigin={appOrigin} />
          )}
        </div>

        {loadStatus === 'loaded' && pastCompetitions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-h2">過去のコンペ</h2>
            {pastCompetitions.map((competition) => (
              <CompetitionCard
                key={competition.id}
                {...competition}
                appOrigin={appOrigin}
                onDeleteClick={() => setDeletingCompetition(competition)}
              />
            ))}
          </div>
        )}

        {toast && <Toast message={toast.message} variant={toast.variant} />}
      </main>

      {confirming && activeCompetition && (
        <ConfirmDialog
          title="新規コンペの開催"
          message={`現在開催中の「${activeCompetition.title}」は終了し、過去のコンペとして保存されます。よろしいですか？`}
          onConfirm={() => void activate()}
          onCancel={() => setConfirming(false)}
        />
      )}

      {deletingCompetition && (
        <DeleteCompetitionDialog
          competitionTitle={deletingCompetition.title}
          deleting={deleting}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setDeletingCompetition(null)}
        />
      )}
    </>
  );
}
