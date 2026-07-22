import { Badge } from '@/components/Badge';
import type { RankedLogo } from '@/lib/types/RankedLogo';

interface RankingListProps {
  items: RankedLogo[];
}

const MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export function RankingList({ items }: RankingListProps) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-4 rounded-md bg-bg-muted p-4 text-text-base">
          <span className="inline-flex h-14 w-14 shrink-0 rotate-[-6deg] items-center justify-center rounded-full border-4 border-double border-ink font-display text-h1 text-ink">
            {MEDALS[item.rank] ?? item.rank}
          </span>
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
            </div>
            <p className="text-body text-text-muted">&ldquo;{item.memo}&rdquo;</p>
          </div>
          <span className="shrink-0 font-mono text-h2">{item.voteCount}票</span>
        </li>
      ))}
    </ol>
  );
}
