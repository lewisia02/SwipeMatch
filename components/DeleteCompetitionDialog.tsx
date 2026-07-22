'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface DeleteCompetitionDialogProps {
  competitionTitle: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteCompetitionDialog({
  competitionTitle,
  deleting,
  onConfirm,
  onCancel,
}: DeleteCompetitionDialogProps) {
  const [input, setInput] = useState('');
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const canConfirm = input === competitionTitle && !deleting;

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-competition-dialog-title"
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md bg-white p-6">
        <h2 id="delete-competition-dialog-title" className="text-h2">
          コンペの削除
        </h2>
        <p className="text-body text-text-muted">
          この操作は取り消せません。投稿・投票データと画像もすべて削除されます。削除するには、コンペ名「{competitionTitle}」を入力してください。
        </p>
        <Input
          id="delete-confirm-title"
          label="コンペ名"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={deleting}
        />
        <div className="flex justify-end gap-3">
          <Button ref={cancelButtonRef} type="button" variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="button" disabled={!canConfirm} loading={deleting} onClick={onConfirm}>
            削除する
          </Button>
        </div>
      </div>
    </div>
  );
}
