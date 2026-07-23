export interface RunoffRound {
  id: string; // UUID
  competitionId: string; // 紐づくCompetitionのID（FK）
  round: number; // 2以上（1は通常の決選投票のため対象外）
  logoIds: string[]; // このラウンドの対象Logo（開始時にスナップショット）
  resolution: 'joint_winner' | null; // 運営が「同率優勝」を選択した場合にのみセットされる
  createdAt: Date;
}
