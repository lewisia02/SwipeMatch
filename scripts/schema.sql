-- SwipeMatch データベーススキーマ
-- Supabase SQL Editorで実行する。
--
-- 本プロダクトはSupabase Authを使用しない完全匿名構成のため、
-- auth.uid()を前提としたRLSポリシーが組めない。
-- 全テーブルでRLSを有効化した上でポリシーを一切定義しない（＝全面deny-all）。
-- サーバー（lib/repositories/経由）はService Role Keyでアクセスするため、
-- RLSをバイパスして読み書きできる。クライアントから直接Supabaseへアクセスする経路は存在しない。
-- (docs/architecture.md の「Supabaseアクセス制御」を参照)

-- gen_random_uuid()用（Supabaseプロジェクトではデフォルトで有効）
create extension if not exists pgcrypto;

-- logos: 投稿されたロゴ作品
create table if not exists logos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  uploader_name text not null,
  memo text not null,
  created_at timestamptz not null default now()
);

alter table logos enable row level security;

-- votes: 決選投票の投票レコード（1票=1行）
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  logo_id uuid not null references logos (id) on delete cascade,
  voter_anon_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists votes_logo_id_idx on votes (logo_id);
create index if not exists votes_voter_anon_id_idx on votes (voter_anon_id);

alter table votes enable row level security;

-- vote_locks: anonId単位で「投票済み」を排他的に確定させるための予約テーブル。
-- voter_anon_idをPRIMARY KEYにすることで、同一anonIdからの同時投票リクエストが
-- 両方とも「未投票」と判定してしまうTOCTOUレース条件をDB制約で防ぐ
-- （countByAnonId等の事前チェックのみではアプリケーション層で原子性を担保できないため）。
create table if not exists vote_locks (
  voter_anon_id text primary key,
  created_at timestamptz not null default now()
);

alter table vote_locks enable row level security;

-- app_settings: イベントフェーズ管理用シングルトン（レコードは常に1件）
create table if not exists app_settings (
  id text primary key,
  current_phase text not null check (current_phase in ('submission', 'voting', 'results')),
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- シングルトン行の初期投入（初回のみ。投稿フェーズから開始する）
insert into app_settings (id, current_phase, updated_at)
values ('singleton', 'submission', now())
on conflict (id) do nothing;
