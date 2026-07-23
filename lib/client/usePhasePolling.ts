import { useEffect, useState } from 'react';
import type { EventPhase } from '@/lib/types/Competition';

const DEFAULT_INTERVAL_MS = 5000;

export type PhasePollingStatus = 'loading' | 'loaded' | 'unknown';

export function usePhasePolling(
  slug: string,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): { phase: EventPhase | null; runoffRound: number | null; status: PhasePollingStatus } {
  const [phase, setPhase] = useState<EventPhase | null>(null);
  const [runoffRound, setRunoffRound] = useState<number | null>(null);
  const [status, setStatus] = useState<PhasePollingStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    function fetchPhase() {
      fetch(`/api/c/${slug}/phase`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('フェーズの取得に失敗しました');
          }
          return res.json();
        })
        .then((body: { phase: EventPhase; runoffRound: number | null }) => {
          if (!cancelled) {
            setPhase(body.phase);
            setRunoffRound(body.runoffRound);
            setStatus('loaded');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus('unknown');
          }
        });
    }

    fetchPhase();
    const timer = setInterval(fetchPhase, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug, intervalMs]);

  return { phase, runoffRound, status };
}
