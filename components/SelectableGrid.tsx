'use client';

import { useEffect, useRef, useState } from 'react';

interface SelectableGridItem {
  id: string;
  imageUrl: string;
  memo: string;
}

interface SelectableGridProps {
  items: SelectableGridItem[];
  selected: string[];
  maxSelectable: number;
  disabled?: boolean;
  onToggle: (id: string) => void;
  onLimitReached?: () => void;
}

export function SelectableGrid({
  items,
  selected,
  maxSelectable,
  disabled = false,
  onToggle,
  onLimitReached,
}: SelectableGridProps) {
  const [shakingId, setShakingId] = useState<string | null>(null);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  function handleClick(id: string) {
    if (disabled) return;

    const isSelected = selected.includes(id);
    if (!isSelected && selected.length >= maxSelectable) {
      setShakingId(id);
      onLimitReached?.();
      if (shakeTimeoutRef.current) {
        clearTimeout(shakeTimeoutRef.current);
      }
      shakeTimeoutRef.current = setTimeout(() => setShakingId(null), 400);
      return;
    }

    onToggle(id);
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => handleClick(item.id)}
            className={`relative aspect-square overflow-hidden rounded-md border-2 disabled:opacity-50 ${
              isSelected ? 'border-primary' : 'border-transparent'
            } ${shakingId === item.id ? 'animate-shake' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.memo} className="h-full w-full object-cover" />
            {isSelected && (
              <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow ring-2 ring-white">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
