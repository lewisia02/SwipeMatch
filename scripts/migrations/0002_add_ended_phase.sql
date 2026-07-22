-- コンペ運用機能拡張: EventPhaseに'ended'（コンペ終了）を追加する
-- Supabase SQL Editorで実行する（0001_add_competitions.sql適用済みの既存プロジェクト向け）。
--
-- current_phaseのCHECK制約は列定義時に自動生成された名前
-- （competitions_current_phase_check）を持つため、一度DROPしてから
-- 'ended'を含む定義で再作成する。
-- (.steering/20260722-コンペ運用機能拡張/design.md の「フェーズ拡張」を参照)

begin;

alter table competitions drop constraint competitions_current_phase_check;
alter table competitions add constraint competitions_current_phase_check
  check (current_phase in ('submission', 'voting', 'results', 'ended'));

commit;
