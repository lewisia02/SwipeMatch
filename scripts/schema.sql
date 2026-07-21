-- SwipeMatch データベーススキーマ
-- Supabase SQL Editorで実行する。新規Supabaseプロジェクトへのフルインストール用。
--
-- 既にapp_settingsベースの旧スキーマが適用済みのプロジェクトには、本ファイルではなく
-- scripts/migrations/0001_add_competitions.sql（既存データを保持した移行用）を適用すること。
--
-- 本プロダクトはSupabase Authを使用しない完全匿名構成のため、
-- auth.uid()を前提としたRLSポリシーが組めない。
-- 全テーブルでRLSを有効化した上でポリシーを一切定義しない（＝全面deny-all）。
-- サーバー（lib/repositories/経由）はService Role Keyでアクセスするため、
-- RLSをバイパスして読み書きできる。クライアントから直接Supabaseへアクセスする経路は存在しない。
-- (docs/architecture.md の「Supabaseアクセス制御」を参照)

-- gen_random_uuid()用（Supabaseプロジェクトではデフォルトで有効）
create extension if not exists pgcrypto;

-- competitions: 開催されるコンペ（イベント）単位のエンティティ
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

-- logos: 投稿されたロゴ作品
create table if not exists logos (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  image_url text not null,
  uploader_name text not null,
  memo text not null,
  created_at timestamptz not null default now()
);

create index if not exists logos_competition_id_idx on logos (competition_id);

alter table logos enable row level security;

-- votes: 決選投票の投票レコード（1票=1行）
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  logo_id uuid not null references logos (id) on delete cascade,
  voter_anon_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists votes_competition_id_idx on votes (competition_id);
create index if not exists votes_logo_id_idx on votes (logo_id);
create index if not exists votes_voter_anon_id_idx on votes (voter_anon_id);

alter table votes enable row level security;

-- vote_locks: コンペ×anonId単位で「投票済み」を排他的に確定させるための予約テーブル。
-- (competition_id, voter_anon_id)を複合PRIMARY KEYにすることで、同一コンペ・同一anonIdからの
-- 同時投票リクエストが両方とも「未投票」と判定してしまうTOCTOUレース条件をDB制約で防ぐ
-- （countByAnonId等の事前チェックのみではアプリケーション層で原子性を担保できないため）。
-- 複合キー化により、多重投票防止の判定単位がコンペ単位になり、別コンペでは同じanonIdでも
-- 独立して投票できる。
create table if not exists vote_locks (
  competition_id uuid not null references competitions (id),
  voter_anon_id text not null,
  created_at timestamptz not null default now(),
  primary key (competition_id, voter_anon_id)
);

alter table vote_locks enable row level security;
