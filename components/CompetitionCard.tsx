import Link from 'next/link';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import type { CompetitionStatus, EventPhase } from '@/lib/types/Competition';

interface CompetitionCardProps {
  id: string;
  slug: string;
  title: string;
  status: CompetitionStatus;
  currentPhase: EventPhase;
  createdAt: Date;
  appOrigin: string;
  onDeleteClick?: () => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function CompetitionCard({
  id,
  slug,
  title,
  status,
  createdAt,
  appOrigin,
  onDeleteClick,
}: CompetitionCardProps) {
  const isActive = status === 'active';

  return (
    <div className="flex flex-col gap-3 rounded-md bg-bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-h2">{title}</span>
        {isActive ? <Badge variant="warning">開催中</Badge> : <Badge>{formatDate(createdAt)}</Badge>}
      </div>

      {isActive && appOrigin && <QRCodeDisplay url={`${appOrigin}/c/${slug}`} />}

      <Link
        href={isActive ? `/admin/competitions/${id}` : `/admin/competitions/${id}/results`}
        className="rounded-md bg-primary px-4 py-2 text-center font-semibold text-white"
      >
        {isActive ? '管理画面を開く' : '結果を見る'}
      </Link>

      {!isActive && onDeleteClick && (
        <Button type="button" variant="secondary" onClick={onDeleteClick}>
          削除
        </Button>
      )}
    </div>
  );
}
