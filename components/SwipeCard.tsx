'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ColorBar } from '@/components/ColorBar';
import { CropMarks } from '@/components/CropMarks';
import type { Logo } from '@/lib/types/Logo';

const SWIPE_THRESHOLD = 100;
const EXIT_DISTANCE = 500;
const EXIT_DURATION_MS = 200;

interface SwipeCardProps {
  logo: Logo;
  onSwipe: (decision: 'keep' | 'skip') => void;
}

export function SwipeCard({ logo, onSwipe }: SwipeCardProps) {
  const x = useMotionValue(0);
  const keepOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const skipOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  async function exitAndDecide(decision: 'keep' | 'skip') {
    const direction = decision === 'keep' ? 1 : -1;
    await animate(x, direction * EXIT_DISTANCE, { duration: EXIT_DURATION_MS / 1000 });
    onSwipe(decision);
  }

  function handleDragEnd() {
    const offset = x.get();
    if (offset > SWIPE_THRESHOLD) {
      exitAndDecide('keep');
    } else if (offset < -SWIPE_THRESHOLD) {
      exitAndDecide('skip');
    } else {
      animate(x, 0, { duration: EXIT_DURATION_MS / 1000 });
    }
  }

  return (
    <div>
      <div className="relative">
        <CropMarks />
        <motion.div
          className="relative overflow-hidden rounded-sm bg-paper shadow"
          style={{ x }}
          drag="x"
          dragElastic={0.6}
          onDragEnd={handleDragEnd}
        >
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 bg-primary/30"
            style={{ opacity: keepOpacity }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 bg-skip/30"
            style={{ opacity: skipOpacity }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.imageUrl} alt={logo.memo} className="aspect-square w-full object-cover" />
          <ColorBar className="h-1.5" />
          <p className="p-4 text-body">{logo.memo}</p>
        </motion.div>
      </div>
      <div className="mt-4 flex justify-between gap-4">
        <button
          type="button"
          onClick={() => exitAndDecide('skip')}
          className="flex-1 rounded-md bg-skip px-4 py-3 font-semibold text-white"
        >
          ✕ 次へ
        </button>
        <button
          type="button"
          onClick={() => exitAndDecide('keep')}
          className="flex-1 rounded-md bg-primary px-4 py-3 font-semibold text-white"
        >
          ♥ キープ
        </button>
      </div>
    </div>
  );
}
