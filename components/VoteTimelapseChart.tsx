'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { RankedLogo } from '@/lib/types/RankedLogo';

const TOTAL_DURATION_MS = 12000;
const MIN_STEP_MS = 60;
const MAX_STEP_MS = 1200;

interface VoteTimelineEntry {
  logoId: string;
  votedAt: string;
}

interface VoteTimelapseChartProps {
  logos: RankedLogo[];
  timeline: VoteTimelineEntry[];
  isPlaying: boolean;
  onComplete: () => void;
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

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const logo of logos) {
      result[logo.id] = 0;
    }
    for (const entry of timeline.slice(0, step)) {
      result[entry.logoId] = (result[entry.logoId] ?? 0) + 1;
    }
    return result;
  }, [logos, timeline, step]);

  // 現在の得票数の降順で並び替える。同数はコンペ全体の最終順位で安定させ、無用な入れ替わりを防ぐ
  const sortedLogos = useMemo(
    () =>
      [...logos].sort((a, b) => {
        const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
        return diff !== 0 ? diff : a.rank - b.rank;
      }),
    [logos, counts],
  );

  return (
    <ol className="flex flex-col gap-2">
      {sortedLogos.map((logo) => {
        const count = counts[logo.id] ?? 0;
        const widthPercent = Math.min(100, (count / finalMaxCount) * 100);
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
            <div className="h-6 flex-1 overflow-hidden rounded-full bg-bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${widthPercent}%` }}
                transition={{
                  duration: shouldReduceMotion ? 0 : (stepDelayMs / 1000) * 0.9,
                  ease: 'easeOut',
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-caption font-semibold">{count}票</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
