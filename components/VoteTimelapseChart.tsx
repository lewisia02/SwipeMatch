'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/Badge';
import type { RankedLogo } from '@/lib/types/RankedLogo';
import { FINAL_VOTE_ROUND } from '@/lib/types/Vote';

const TOTAL_DURATION_MS = 12000;
const MIN_STEP_MS = 60;
const MAX_STEP_MS = 1200;

interface VoteTimelineEntry {
  logoId: string;
  votedAt: string;
  round: number;
}

interface VoteTimelapseChartProps {
  logos: RankedLogo[];
  timeline: VoteTimelineEntry[];
  isPlaying: boolean;
  onComplete: () => void;
}

function phaseLabel(round: number): string {
  return round === FINAL_VOTE_ROUND ? '決選投票' : `ランオフ ラウンド${round}`;
}

export function VoteTimelapseChart({ logos, timeline, isPlaying, onComplete }: VoteTimelapseChartProps) {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  // 投票数に応じて1票あたりの間隔を自動調整し、総再生時間が極端に長短化しないようにする
  const stepDelayMs = useMemo(() => {
    if (timeline.length === 0) return MAX_STEP_MS;
    return Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, TOTAL_DURATION_MS / timeline.length));
  }, [timeline.length]);

  const finalMaxCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of timeline) {
      counts[entry.logoId] = (counts[entry.logoId] ?? 0) + 1;
    }
    return Math.max(1, ...Object.values(counts));
  }, [timeline]);

  const hasRunoffPhase = useMemo(
    () => timeline.some((entry) => entry.round !== FINAL_VOTE_ROUND),
    [timeline],
  );

  useEffect(() => {
    if (isPlaying) {
      setStep(0);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    if (step >= timeline.length) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setStep((s) => s + 1), stepDelayMs);
    return () => clearTimeout(timer);
  }, [isPlaying, step, timeline.length, stepDelayMs, onComplete]);

  // 決選投票(round1)とランオフ(round2以降)の得票を色分けして積み上げ表示するため、別々に集計する
  const { finalVoteCounts, runoffVoteCounts } = useMemo(() => {
    const finalCounts: Record<string, number> = {};
    const runoffCounts: Record<string, number> = {};
    for (const logo of logos) {
      finalCounts[logo.id] = 0;
      runoffCounts[logo.id] = 0;
    }
    for (const entry of timeline.slice(0, step)) {
      const bucket = entry.round === FINAL_VOTE_ROUND ? finalCounts : runoffCounts;
      bucket[entry.logoId] = (bucket[entry.logoId] ?? 0) + 1;
    }
    return { finalVoteCounts: finalCounts, runoffVoteCounts: runoffCounts };
  }, [logos, timeline, step]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const logo of logos) {
      result[logo.id] = (finalVoteCounts[logo.id] ?? 0) + (runoffVoteCounts[logo.id] ?? 0);
    }
    return result;
  }, [logos, finalVoteCounts, runoffVoteCounts]);

  // 現在の得票数の降順で並び替える。同数はコンペ全体の最終順位で安定させ、無用な入れ替わりを防ぐ
  const sortedLogos = useMemo(
    () =>
      [...logos].sort((a, b) => {
        const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
        return diff !== 0 ? diff : a.rank - b.rank;
      }),
    [logos, counts],
  );

  const activeRound = timeline[Math.min(step, timeline.length - 1)]?.round ?? FINAL_VOTE_ROUND;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Badge>{phaseLabel(activeRound)}</Badge>
        {hasRunoffPhase && (
          <div className="flex items-center gap-3 text-caption text-paper/70">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" />
              決選投票
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              ランオフ
            </span>
          </div>
        )}
      </div>
      <ol className="flex flex-col gap-2">
        {sortedLogos.map((logo) => {
          const finalWidthPercent = Math.min(100, ((finalVoteCounts[logo.id] ?? 0) / finalMaxCount) * 100);
          const runoffWidthPercent = Math.min(
            100 - finalWidthPercent,
            ((runoffVoteCounts[logo.id] ?? 0) / finalMaxCount) * 100,
          );
          const transition = {
            duration: shouldReduceMotion ? 0 : (stepDelayMs / 1000) * 0.9,
            ease: 'easeOut' as const,
          };
          return (
            <motion.li
              key={logo.id}
              layout
              transition={{ duration: shouldReduceMotion ? 0 : 0.4 }}
              className="flex items-center gap-3"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.imageUrl}
                  alt={logo.memo || '投稿されたロゴ画像'}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="w-28 shrink-0 truncate text-caption">{logo.uploaderName}</span>
              <div className="flex h-6 flex-1 overflow-hidden rounded-full bg-bg-muted">
                <motion.div
                  className="h-full shrink-0 bg-primary"
                  initial={false}
                  animate={{ width: `${finalWidthPercent}%` }}
                  transition={transition}
                />
                <motion.div
                  className="h-full shrink-0 bg-secondary"
                  initial={false}
                  animate={{ width: `${runoffWidthPercent}%` }}
                  transition={transition}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-caption font-semibold">
                {counts[logo.id] ?? 0}票
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
