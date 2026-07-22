'use client';

import { usePhasePolling } from '@/lib/client/usePhasePolling';

function messageForPhase(phase: string | null): string {
  if (phase === 'results') {
    return 'ただいま結果発表中です。会場の画面をご確認ください';
  }
  if (phase === 'ended') {
    return 'コンペは終了しました。ご参加ありがとうございました';
  }
  return '投票ありがとうございました。結果発表をお楽しみに🎉';
}

export function WaitingForResults({ slug }: { slug: string }) {
  const { phase } = usePhasePolling(slug);

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <p className="text-body">{messageForPhase(phase)}</p>
    </div>
  );
}
