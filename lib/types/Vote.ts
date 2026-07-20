export interface Vote {
  id: string; // UUID
  competitionId: string; // 紐づくCompetitionのID（FK）
  logoId: string; // 投票対象のLogo ID（FK）
  voterAnonId: string; // 投票者の匿名ID（サーバー発行のhttpOnly Cookie `anon_id` の値）
  createdAt: Date; // 投票日時
}
