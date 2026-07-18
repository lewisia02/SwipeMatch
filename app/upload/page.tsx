'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { Toast } from '@/components/Toast';
import { convertHeicToJpegIfNeeded } from '@/lib/client/convertHeicToJpeg';
import type { EventPhase } from '@/lib/types/AppSettings';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

type Status = 'idle' | 'converting' | 'uploading' | 'submitting' | 'success' | 'error';
type PhaseCheckStatus = 'loading' | 'open' | 'closed' | 'unknown';

function putFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error('画像のアップロードに失敗しました'));
      }
    };
    xhr.onerror = () => reject(new Error('画像のアップロードに失敗しました'));
    xhr.send(file);
  });
}

export default function UploadPage() {
  const router = useRouter();
  const [phaseCheckStatus, setPhaseCheckStatus] = useState<PhaseCheckStatus>('loading');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploaderName, setUploaderName] = useState('');
  const [memo, setMemo] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploaderNameError, setUploaderNameError] = useState<string | null>(null);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/phase')
      .then((res) => res.json())
      .then((body: { phase: EventPhase }) => {
        if (!cancelled) {
          setPhaseCheckStatus(body.phase === 'submission' ? 'open' : 'closed');
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
  }, []);

  const isFormDisabled = phaseCheckStatus === 'closed';
  const isBusy = status === 'converting' || status === 'uploading' || status === 'submitting';

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setImageError('画像は10MB以下のjpg/png/heic/webp形式でアップロードしてください');
      return;
    }

    setImageError(null);
    setStatus('converting');
    try {
      const converted = await convertHeicToJpegIfNeeded(selected);
      setFile(converted);
      setPreviewUrl(URL.createObjectURL(converted));
      setStatus('idle');
    } catch {
      setImageError('画像の変換に失敗しました。別の画像をお試しください');
      setStatus('error');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    let hasError = false;
    if (!file) {
      setImageError('画像を選択してください');
      hasError = true;
    }
    if (!uploaderName) {
      setUploaderNameError('投稿者名を入力してください');
      hasError = true;
    } else {
      setUploaderNameError(null);
    }
    if (!memo) {
      setMemoError('一口メモを入力してください');
      hasError = true;
    } else {
      setMemoError(null);
    }
    if (hasError || !file) return;

    setToastMessage(null);

    try {
      setStatus('uploading');
      setProgress(0);
      const upstartRes = await fetch('/api/logos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!upstartRes.ok) {
        const body = await upstartRes.json();
        throw new Error(body.message ?? '投稿の準備に失敗しました');
      }
      const { uploadUrl, storagePath } = await upstartRes.json();

      await putFileWithProgress(uploadUrl, file, setProgress);

      setStatus('submitting');
      const createRes = await fetch('/api/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, uploaderName, memo }),
      });
      if (!createRes.ok) {
        const body = await createRes.json();
        throw new Error(body.message ?? '投稿に失敗しました');
      }

      setStatus('success');
      setToastMessage('投稿ありがとうございました');
      setTimeout(() => router.push('/'), 1500);
    } catch (error) {
      setStatus('error');
      setToastMessage(error instanceof Error ? error.message : '投稿に失敗しました');
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-caption text-text-muted">
          ← 戻る
        </Link>
        <h1 className="text-h1">画像を投稿する</h1>
      </div>

      {phaseCheckStatus === 'closed' && (
        <p className="text-caption rounded-md bg-bg-muted p-3 text-text-muted">
          投稿受付は終了しました
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="image" className="text-sm font-medium">
            ロゴ画像
          </label>
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileChange}
            disabled={isBusy || isFormDisabled}
          />
          {imageError && <p className="text-xs text-danger">{imageError}</p>}
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="投稿されたロゴ画像のプレビュー" className="max-h-64 rounded-md" />
          )}
        </div>

        <Input
          id="uploaderName"
          label="投稿者名"
          value={uploaderName}
          maxLength={50}
          error={uploaderNameError ?? undefined}
          onChange={(e) => setUploaderName(e.target.value)}
          disabled={isBusy || isFormDisabled}
          required
        />

        <Textarea
          id="memo"
          label="一口メモ"
          value={memo}
          maxLength={200}
          error={memoError ?? undefined}
          onChange={(e) => setMemo(e.target.value)}
          disabled={isBusy || isFormDisabled}
          required
        />

        {status === 'uploading' && (
          <div aria-live="polite" className="text-caption text-text-muted">
            アップロード中... {progress}%
          </div>
        )}

        <Button type="submit" loading={isBusy} disabled={isFormDisabled}>
          投稿する
        </Button>
      </form>

      {toastMessage && (
        <Toast message={toastMessage} variant={status === 'success' ? 'success' : 'error'} />
      )}
    </main>
  );
}
