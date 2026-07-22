export type EventPhase = 'submission' | 'voting' | 'results' | 'ended';
export type CompetitionStatus = 'active' | 'closed';

export interface Competition {
  id: string; // UUID
  slug: string; // URLに使うランダムな短い識別子（例: "x7k2p9"）。一意
  title: string; // 管理者が入力するコンペの題名
  status: CompetitionStatus;
  currentPhase: EventPhase; // このコンペのフェーズ
  createdAt: Date;
  closedAt: Date | null; // クローズされた日時（開催中はnull）
}
