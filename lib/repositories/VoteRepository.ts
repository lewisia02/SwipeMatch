import { getSupabaseClient } from '@/lib/supabase/client';
import type { Vote } from '@/lib/types/Vote';

interface VoteRow {
  id: string;
  logo_id: string;
  voter_anon_id: string;
  created_at: string;
}

function toVote(row: VoteRow): Vote {
  return {
    id: row.id,
    logoId: row.logo_id,
    voterAnonId: row.voter_anon_id,
    createdAt: new Date(row.created_at),
  };
}

const UNIQUE_VIOLATION_CODE = '23505';

export class VoteRepository {
  // vote_locksテーブルのPRIMARY KEY制約により、同一anonIdからの同時リクエストでも
  // どちらか一方のみがtrueを受け取ることをDB側で保証する（TOCTOUレース対策）
  async reserveVoteSlot(anonId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('vote_locks').insert({ voter_anon_id: anonId });

    if (!error) {
      return true;
    }
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return false;
    }
    throw new Error(`投票枠の確保に失敗しました: ${error.message}`);
  }

  // Vote作成が失敗した場合に予約を取り消し、再投票を可能にする補償処理用
  async releaseVoteSlot(anonId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('vote_locks').delete().eq('voter_anon_id', anonId);

    if (error) {
      throw new Error(`投票枠の解放に失敗しました: ${error.message}`);
    }
  }

  async createMany(votes: Omit<Vote, 'id' | 'createdAt'>[]): Promise<Vote[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('votes')
      .insert(votes.map((vote) => ({ logo_id: vote.logoId, voter_anon_id: vote.voterAnonId })))
      .select();

    if (error) {
      throw new Error(`Voteの作成に失敗しました: ${error.message}`);
    }

    return (data as VoteRow[]).map(toVote);
  }

  async countByAnonId(anonId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('voter_anon_id', anonId);

    if (error) {
      throw new Error(`投票件数の取得に失敗しました: ${error.message}`);
    }

    return count ?? 0;
  }

  async countByLogoId(): Promise<Record<string, number>> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('votes').select('logo_id');

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
