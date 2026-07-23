-- ランオフ機能: 同着得票時の再投票フェーズを追加する
-- Supabase SQL Editorで実行する（0002_add_ended_phase.sql適用済みの既存プロジェクト向け）。
-- (.steering/20260722-ランオフ機能/design.md の「データモデル」を参照)

begin;

-- competitions: フェーズに'runoff'を追加し、現在受付中のランオフラウンドを保持する列を追加
alter table competitions drop constraint competitions_current_phase_check;
alter table competitions add constraint competitions_current_phase_check
  check (current_phase in ('submission', 'voting', 'results', 'runoff', 'ended'));

alter table competitions add column if not exists runoff_round int;

-- votes: どのラウンドの投票かを区別するための列を追加（既存データはround=1として扱う）
alter table votes add column if not exists round int not null default 1;

create index if not exists votes_competition_id_round_idx on votes (competition_id, round);

-- vote_locks: 複合PRIMARY KEYにroundを含める形へ変更する
alter table vote_locks add column if not exists round int not null default 1;

alter table vote_locks drop constraint vote_locks_pkey;
alter table vote_locks add primary key (competition_id, voter_anon_id, round);

-- runoff_rounds: ランオフ各回の対象Logoと解決状況を記録する新規テーブル
create table if not exists runoff_rounds (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  round int not null check (round >= 2),
  logo_ids uuid[] not null,
  resolution text check (resolution in ('joint_winner')),
  created_at timestamptz not null default now(),
  unique (competition_id, round)
);

alter table runoff_rounds enable row level security;

commit;
