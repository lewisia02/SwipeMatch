export type EventPhase = 'submission' | 'voting' | 'results' | 'runoff' | 'ended';
export type CompetitionStatus = 'active' | 'closed';

export interface Competition {
  id: string; // UUID
  slug: string; // URLに使うランダムな短い識別子（例: "x7k2p9"）。一意
  title: string; // 管理者が入力するコンペの題名
  status: CompetitionStatus;
  currentPhase: EventPhase; // このコンペのフェーズ
  runoffRound: number | null; // 現在投票を受け付けているランオフのラウンド番号。受付中でなければnull
  createdAt: Date;
  closedAt: Date | null; // クローズされた日時（開催中はnull）
}
