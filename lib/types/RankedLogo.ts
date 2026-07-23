import type { Logo } from '@/lib/types/Logo';

export interface RankedLogo extends Logo {
  voteCount: number;
  rank: number;
  isTiedForRunoff: boolean; // 同順位で境界にかかる場合にランオフ対象としてフラグを立てる
  isJointWinner: boolean; // 運営がランオフの「同率優勝」を選択した対象の場合にtrue
}
