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
        <li key={item.id} className="flex items-center gap-4 rounded-md bg-bg-muted p-4">
          <span className="text-h1 w-12 shrink-0 text-center">{MEDALS[item.rank] ?? item.rank}</span>
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
          <span className="text-h2 shrink-0">{item.voteCount}票</span>
        </li>
      ))}
    </ol>
  );
}
