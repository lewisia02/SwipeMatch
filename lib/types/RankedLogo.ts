import type { Logo } from '@/lib/types/Logo';

export interface RankedLogo extends Logo {
  voteCount: number; // finalRoundVoteCount + runoffVoteCount の合算値
  finalRoundVoteCount: number; // 決選投票（round=1）の得票数
  runoffVoteCount: number; // 関与した全ランオフラウンドの得票数の合計（対象外なら0）
  rank: number;
  isTiedForRunoff: boolean; // 同順位で境界にかかる場合にランオフ対象としてフラグを立てる
  isJointWinner: boolean; // 運営がランオフの「同率優勝」を選択した対象の場合にtrue
}
