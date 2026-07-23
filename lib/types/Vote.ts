export const FINAL_VOTE_ROUND = 1; // 通常の決選投票のラウンド番号（2以降はランオフ）

export interface Vote {
  id: string; // UUID
  competitionId: string; // 紐づくCompetitionのID（FK）
  logoId: string; // 投票対象のLogo ID（FK）
  voterAnonId: string; // 投票者の匿名ID（サーバー発行のhttpOnly Cookie `anon_id` の値）
  round: number; // 1 = 通常の決選投票、2以降 = ランオフの各回
  createdAt: Date; // 投票日時
}
