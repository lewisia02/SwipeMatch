export type EventPhase = 'submission' | 'voting' | 'results';

export interface AppSettings {
  id: string; // 固定ID（シングルトン運用）
  currentPhase: EventPhase; // 現在のイベントフェーズ
  updatedAt: Date;
}
