export interface Logo {
  id: string; // UUID
  competitionId: string; // 紐づくCompetitionのID（FK）
  imageUrl: string; // Supabase Storage上の画像URL
  uploaderName: string; // 投稿者名（管理者画面でのみ表示、投票画面では非表示）
  memo: string; // 一口メモ（投票画面に表示、匿名）
  createdAt: Date; // 投稿日時
}
