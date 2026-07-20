'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

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
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md bg-white p-6">
        <h2 id="confirm-dialog-title" className="text-h2">
          {title}
        </h2>
        <p className="text-body text-text-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <Button ref={cancelButtonRef} type="button" variant="secondary" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="button" onClick={onConfirm}>
            確定
          </Button>
        </div>
      </div>
    </div>
  );
}
