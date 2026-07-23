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
  current_phase text not null check (current_phase in ('submission', 'voting', 'results', 'runoff', 'ended')),
  -- 現在ランオフ投票を受け付けているラウンド番号（2以上）。受付中でなければnull
  runoff_round int,
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
-- round: 1が通常の決選投票、2以降がランオフの各回に対応する
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  logo_id uuid not null references logos (id) on delete cascade,
  voter_anon_id text not null,
  round int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists votes_competition_id_idx on votes (competition_id);
create index if not exists votes_logo_id_idx on votes (logo_id);
create index if not exists votes_voter_anon_id_idx on votes (voter_anon_id);
create index if not exists votes_competition_id_round_idx on votes (competition_id, round);

alter table votes enable row level security;

-- vote_locks: コンペ×anonId×ラウンド単位で「投票済み」を排他的に確定させるための予約テーブル。
-- (competition_id, voter_anon_id, round)を複合PRIMARY KEYにすることで、同一コンペ・同一anonId・
-- 同一ラウンドからの同時投票リクエストが両方とも「未投票」と判定してしまうTOCTOUレース条件を
-- DB制約で防ぐ（countByAnonId等の事前チェックのみではアプリケーション層で原子性を担保できないため）。
-- 複合キー化により、多重投票防止の判定単位がコンペ×ラウンド単位になり、別コンペ・別ラウンドでは
-- 同じanonIdでも独立して投票できる（ランオフはround=2以降として同一コンペ内で複数ラウンドを持つ）。
create table if not exists vote_locks (
  competition_id uuid not null references competitions (id),
  voter_anon_id text not null,
  round int not null default 1,
  created_at timestamptz not null default now(),
  primary key (competition_id, voter_anon_id, round)
);

alter table vote_locks enable row level security;

-- runoff_rounds: 同着発生時のランオフ各回の対象Logoと解決状況を記録する
-- （round=1は通常決選投票のため対象外。roundは2以上のみ）
create table if not exists runoff_rounds (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  round int not null check (round >= 2),
  logo_ids uuid[] not null,
  -- 運営が「同率優勝」を選択した場合にのみ'joint_winner'が入り、以降そのラウンドの対象は
  -- 順位を上書きせず同順位のまま確定する。それ以外（再投票で解消 or 継続中）はnull
  resolution text check (resolution in ('joint_winner')),
  created_at timestamptz not null default now(),
  unique (competition_id, round)
);

alter table runoff_rounds enable row level security;
