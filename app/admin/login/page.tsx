'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

type Status = 'idle' | 'loading' | 'error';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionMessage = searchParams.get('message');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!password) {
      setPasswordError('パスワードを入力してください');
      return;
    }
    setPasswordError(null);
    setErrorMessage(null);
    setStatus('loading');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const body: { message?: string } = await res.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(body.message ?? 'パスワードが正しくありません');
        return;
      }

      router.push('/admin');
    } catch {
      setStatus('error');
      setErrorMessage('エラーが発生しました。時間をおいて再度お試しください');
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-h1">管理者ログイン</h1>

      {sessionMessage && <p className="text-caption text-danger">{sessionMessage}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="password"
          label="パスワード"
          type="password"
          value={password}
          error={passwordError ?? undefined}
          onChange={(e) => setPassword(e.target.value)}
          disabled={status === 'loading'}
          required
        />

        {status === 'error' && errorMessage && (
          <p className="text-caption text-danger">{errorMessage}</p>
        )}

        <Button type="submit" loading={status === 'loading'}>
          ログイン
        </Button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
