'use client';

import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
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

function AnimatedVoteCount({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, value, { duration: COUNT_UP_DURATION_SEC });
    const unsubscribe = rounded.on('change', setDisplay);
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, rounded, value]);

  return <span className="text-h2 shrink-0">{display}票</span>;
}

export function AnimatedRankingList({ items, isPlaying, onComplete }: AnimatedRankingListProps) {
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4 rounded-md bg-bg-muted p-4"
          >
            <span className="text-h1 w-12 shrink-0 text-center">
              {MEDALS[item.rank] ?? item.rank}
            </span>
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.memo || '投稿されたロゴ画像'}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-h2">{item.uploaderName}</span>
                {item.isTiedForRunoff && <Badge variant="warning">同着（ランオフ対象）</Badge>}
              </div>
              <p className="text-body text-text-muted">&ldquo;{item.memo}&rdquo;</p>
            </div>
            <AnimatedVoteCount value={item.voteCount} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
