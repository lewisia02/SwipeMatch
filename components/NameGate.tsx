'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { getParticipantName, setParticipantName } from '@/lib/client/participantName';

export function NameGate({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<string | null>(() => getParticipantName());
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('名前を入力してください');
      return;
    }
    if (trimmed.length > 50) {
      setError('名前は50文字以内で入力してください');
      return;
    }
    setParticipantName(trimmed);
    setName(trimmed);
  }

  if (name) {
    return <>{children}</>;
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-h1">お名前を入力してください</h1>
      <p className="text-body text-text-muted">
        投稿の際に表示される名前です。何でも構いません。
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          id="participant-name"
          label="名前"
          value={input}
          maxLength={50}
          error={error ?? undefined}
          onChange={(e) => setInput(e.target.value)}
          required
        />
        <Button type="submit">はじめる</Button>
      </form>
    </main>
  );
}
