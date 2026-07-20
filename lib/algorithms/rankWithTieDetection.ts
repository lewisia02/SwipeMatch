import type { Logo } from '@/lib/types/Logo';
import type { RankedLogo } from '@/lib/types/RankedLogo';

/**
 * 得票数の同数判定を行い、ランオフ対象にフラグを立てる
 *
 * @param logos - 得票数を含むLogo一覧
 * @returns 順位とランオフ判定を付与したLogo一覧
 */
export function rankWithTieDetection(logos: (Logo & { voteCount: number })[]): RankedLogo[] {
  const sorted = [...logos].sort((a, b) => b.voteCount - a.voteCount);
  const topVoteCount = sorted[0]?.voteCount ?? 0;

  return sorted.map((logo, index) => ({
    ...logo,
    rank: index + 1,
    isTiedForRunoff:
      logo.voteCount === topVoteCount &&
      sorted.filter((l) => l.voteCount === topVoteCount).length > 1,
  }));
}
