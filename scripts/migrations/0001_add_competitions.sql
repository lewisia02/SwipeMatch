-- 複数コンペ対応: competitionsテーブルの新設と既存データの移行
-- Supabase SQL Editorで実行する（既にscripts/schema.sqlの旧スキーマ
-- （app_settingsベース）が適用済みの本番プロジェクト向けの一度きりの移行）。
--
-- 実行内容:
--   1. competitionsテーブルを作成する（status='active'の部分ユニークインデックス含む）
--   2. 既存app_settings（シングルトン行）を基に、最初のCompetitionレコードをactiveで作成する
--   3. 既存logos/votes/vote_locks全件に、作成したcompetition_idを一括UPDATEで設定する
--   4. competition_idをNOT NULL化し、vote_locksの主キーを複合キーに変更する
--
-- app_settingsテーブル自体はこのマイグレーションでは削除しない（ロールバック余地のため）。
-- 削除は動作確認後の別マイグレーション（0002_drop_app_settings.sql）で行う。
-- (docs/architecture.md の「マイグレーション戦略」を参照)

begin;

-- gen_random_uuid() / gen_random_bytes() 用（Supabaseプロジェクトではデフォルトで有効）
create extension if not exists pgcrypto;

-- 1. competitions テーブルを作成する
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null check (status in ('active', 'closed')),
  current_phase text not null check (current_phase in ('submission', 'voting', 'results')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- status='active' のレコードは常に0件または1件であることを保証する
create unique index if not exists competitions_active_status_idx
  on competitions (status)
  where status = 'active';

alter table competitions enable row level security;

-- 2〜3. 既存app_settingsを基に最初のCompetitionレコードを作成し、
--       既存logos/votes/vote_locksに一括でcompetition_idを設定する
do $$
declare
  v_competition_id uuid;
  v_current_phase text;
  v_slug text;
begin
  -- 既存のシングルトンapp_settings行があればcurrent_phaseを引き継ぐ（無ければ初期値）
  select current_phase into v_current_phase from app_settings where id = 'singleton';
  if v_current_phase is null then
    v_current_phase := 'submission';
  end if;

  -- lib/algorithms/generateSlug.ts の生成ロジック
  -- （crypto.randomBytes(6).toString('base64url').slice(0, 8)）と同等の値をSQL側で生成する
  v_slug := left(
    translate(encode(gen_random_bytes(6), 'base64'), '+/', '-_'),
    8
  );

  insert into competitions (slug, title, status, current_phase, created_at)
  values (v_slug, '第1回ロゴ作成大会', 'active', v_current_phase, now())
  returning id into v_competition_id;

  -- logos / votes / vote_locks に competition_id カラムを追加し、既存全件に一括設定する
  alter table logos add column if not exists competition_id uuid references competitions (id);
  update logos set competition_id = v_competition_id where competition_id is null;

  alter table votes add column if not exists competition_id uuid references competitions (id);
  update votes set competition_id = v_competition_id where competition_id is null;

  alter table vote_locks add column if not exists competition_id uuid references competitions (id);
  update vote_locks set competition_id = v_competition_id where competition_id is null;
end $$;

-- 4. competition_id をNOT NULL化する
alter table logos alter column competition_id set not null;
alter table votes alter column competition_id set not null;
alter table vote_locks alter column competition_id set not null;

-- competition_idでの絞り込みクエリが劣化しないようインデックスを張る
create index if not exists logos_competition_id_idx on logos (competition_id);
create index if not exists votes_competition_id_idx on votes (competition_id);

-- vote_locksの主キーを (competition_id, voter_anon_id) の複合キーに変更する
-- （多重投票防止の判定単位をコンペ単位にし、別コンペでは同じanonIdでも独立してカウントする）
alter table vote_locks drop constraint vote_locks_pkey;
alter table vote_locks add primary key (competition_id, voter_anon_id);

commit;
