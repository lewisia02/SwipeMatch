'use client';

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/Badge';
import type { RankedLogo } from '@/lib/types/RankedLogo';

const REVEAL_INTERVAL_MS = 1200;
const COUNT_UP_DURATION_SEC = 0.8;

const MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

interface AnimatedRankingListProps {
  items: RankedLogo[];
  isPlaying: boolean;
  onComplete: () => void;
}

function AnimatedVoteCount({ value, label }: { value: number; label?: string }) {
  const shouldReduceMotion = useReducedMotion();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, { duration: shouldReduceMotion ? 0 : COUNT_UP_DURATION_SEC });
    const unsubscribe = rounded.on('change', setDisplay);
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, rounded, value, shouldReduceMotion]);

  if (label) {
    return (
      <span className="font-mono text-body">
        {label}
        {display}票
      </span>
    );
  }

  return <span className="shrink-0 font-mono text-h2">{display}票</span>;
}

export function AnimatedRankingList({ items, isPlaying, onComplete }: AnimatedRankingListProps) {
  const shouldReduceMotion = useReducedMotion();
  // 発表順（下位→上位）と最終表示順（上位→下位）を別々に保持する
  const sortedByRank = useMemo(() => [...items].sort((a, b) => a.rank - b.rank), [items]);
  const revealOrder = useMemo(() => [...sortedByRank].reverse(), [sortedByRank]);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      setRevealedCount(0);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    if (revealedCount >= revealOrder.length) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => {
      setRevealedCount((count) => count + 1);
    }, REVEAL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, revealedCount, revealOrder.length, onComplete]);

  const revealedIds = useMemo(
    () => new Set(revealOrder.slice(0, revealedCount).map((item) => item.id)),
    [revealOrder, revealedCount],
  );
  const visibleItems = sortedByRank.filter((item) => revealedIds.has(item.id));

  return (
    <ol className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {visibleItems.map((item) => (
          <motion.li
            key={item.id}
            layout
            initial={shouldReduceMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
            className="flex items-center gap-4 rounded-md bg-bg-muted p-4 text-text-base"
          >
            <motion.span
              initial={shouldReduceMotion ? false : { scale: 1.6, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 15 }
              }
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-double border-ink font-display text-h1 text-ink"
            >
              {MEDALS[item.rank] ?? item.rank}
            </motion.span>
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.memo || '投稿されたロゴ画像'}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-h2">{item.uploaderName}</span>
                {item.isTiedForRunoff && <Badge variant="warning">同着（ランオフ対象）</Badge>}
                {item.isJointWinner && <Badge variant="success">🤝 同率</Badge>}
              </div>
              <p className="text-body text-text-muted">&ldquo;{item.memo}&rdquo;</p>
            </div>
            {item.runoffVoteCount > 0 ? (
              <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
                <AnimatedVoteCount label="決選投票" value={item.finalRoundVoteCount} />＋
                <AnimatedVoteCount label="ランオフ" value={item.runoffVoteCount} />
              </span>
            ) : (
              <AnimatedVoteCount value={item.voteCount} />
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
