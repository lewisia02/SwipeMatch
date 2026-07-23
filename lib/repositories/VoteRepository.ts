import { getSupabaseClient } from '@/lib/supabase/client';
import type { Vote } from '@/lib/types/Vote';

interface VoteRow {
  id: string;
  competition_id: string;
  logo_id: string;
  voter_anon_id: string;
  round: number;
  created_at: string;
}

function toVote(row: VoteRow): Vote {
  return {
    id: row.id,
    competitionId: row.competition_id,
    logoId: row.logo_id,
    voterAnonId: row.voter_anon_id,
    round: row.round,
    createdAt: new Date(row.created_at),
  };
}

const UNIQUE_VIOLATION_CODE = '23505';

export class VoteRepository {
  // vote_locksテーブルの複合PRIMARY KEY（competition_id, voter_anon_id, round）制約により、
  // 同一コンペ・同一anonId・同一ラウンドからの同時リクエストでもどちらか一方のみがtrueを
  // 受け取ることをDB側で保証する（TOCTOUレース対策）。別コンペ・別ラウンドでは同じanonIdでも
  // 独立して予約できる（ランオフはround=2以降として同一コンペ内で複数ラウンドを持つ）
  async reserveVoteSlot(competitionId: string, anonId: string, round: number): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('vote_locks')
      .insert({ competition_id: competitionId, voter_anon_id: anonId, round });

    if (!error) {
      return true;
    }
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return false;
    }
    throw new Error(`投票枠の確保に失敗しました: ${error.message}`);
  }

  // Vote作成が失敗した場合に予約を取り消し、再投票を可能にする補償処理用
  async releaseVoteSlot(competitionId: string, anonId: string, round: number): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('vote_locks')
      .delete()
      .eq('competition_id', competitionId)
      .eq('voter_anon_id', anonId)
      .eq('round', round);

    if (error) {
      throw new Error(`投票枠の解放に失敗しました: ${error.message}`);
    }
  }

  // コンペ削除用。vote_locks.competition_idにはCASCADEが無いため明示的に削除する
  async deleteLocksByCompetitionId(competitionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('vote_locks')
      .delete()
      .eq('competition_id', competitionId);

    if (error) {
      throw new Error(`投票予約の一括削除に失敗しました: ${error.message}`);
    }
  }

  async createMany(votes: Omit<Vote, 'id' | 'createdAt'>[]): Promise<Vote[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('votes')
      .insert(
        votes.map((vote) => ({
          competition_id: vote.competitionId,
          logo_id: vote.logoId,
          voter_anon_id: vote.voterAnonId,
          round: vote.round,
        })),
      )
      .select();

    if (error) {
      throw new Error(`Voteの作成に失敗しました: ${error.message}`);
    }

    return (data as VoteRow[]).map(toVote);
  }

  async countByAnonId(competitionId: string, anonId: string, round: number): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId)
      .eq('voter_anon_id', anonId)
      .eq('round', round);

    if (error) {
      throw new Error(`投票件数の取得に失敗しました: ${error.message}`);
    }

    return count ?? 0;
  }

  // 投票タイムライン用。voterAnonIdは匿名性維持のため呼び出し元では使用しない
  async findAllByCompetitionId(competitionId: string): Promise<Vote[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('competition_id', competitionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Vote一覧の取得に失敗しました: ${error.message}`);
    }

    return (data as VoteRow[]).map(toVote);
  }

  async countVoters(competitionId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('vote_locks')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId);

    if (error) {
      throw new Error(`投票済み人数の取得に失敗しました: ${error.message}`);
    }

    return count ?? 0;
  }

  async countTotal(competitionId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId);

    if (error) {
      throw new Error(`総投票数の取得に失敗しました: ${error.message}`);
    }

    return count ?? 0;
  }

  async countByLogoId(competitionId: string, round: number): Promise<Record<string, number>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('votes')
      .select('logo_id')
      .eq('competition_id', competitionId)
      .eq('round', round);

    if (error) {
      throw new Error(`得票数の集計に失敗しました: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const row of data as { logo_id: string }[]) {
      counts[row.logo_id] = (counts[row.logo_id] ?? 0) + 1;
    }
    return counts;
  }
}
