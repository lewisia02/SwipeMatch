import { getSupabaseClient } from '@/lib/supabase/client';
import type { RunoffRound } from '@/lib/types/RunoffRound';

interface RunoffRoundRow {
  id: string;
  competition_id: string;
  round: number;
  logo_ids: string[];
  resolution: 'joint_winner' | null;
  created_at: string;
}

function toRunoffRound(row: RunoffRoundRow): RunoffRound {
  return {
    id: row.id,
    competitionId: row.competition_id,
    round: row.round,
    logoIds: row.logo_ids,
    resolution: row.resolution,
    createdAt: new Date(row.created_at),
  };
}

export class RunoffRoundRepository {
  async createRound(competitionId: string, round: number, logoIds: string[]): Promise<RunoffRound> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('runoff_rounds')
      .insert({ competition_id: competitionId, round, logo_ids: logoIds })
      .select()
      .single();

    if (error) {
      throw new Error(`ランオフラウンドの作成に失敗しました: ${error.message}`);
    }

    return toRunoffRound(data as RunoffRoundRow);
  }

  // round降順で1件取得。現在または直近のランオフラウンドの対象・解決状況を知るために使う
  async findLatestRound(competitionId: string): Promise<RunoffRound | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('runoff_rounds')
      .select('*')
      .eq('competition_id', competitionId)
      .order('round', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`ランオフラウンドの取得に失敗しました: ${error.message}`);
    }

    return data ? toRunoffRound(data as RunoffRoundRow) : null;
  }

  async findAllByCompetitionId(competitionId: string): Promise<RunoffRound[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('runoff_rounds')
      .select('*')
      .eq('competition_id', competitionId)
      .order('round', { ascending: true });

    if (error) {
      throw new Error(`ランオフラウンド一覧の取得に失敗しました: ${error.message}`);
    }

    return (data as RunoffRoundRow[]).map(toRunoffRound);
  }

  // コンペ削除用。runoff_rounds.competition_idにはCASCADEが無いため明示的に削除する
  async deleteAllByCompetitionId(competitionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('runoff_rounds')
      .delete()
      .eq('competition_id', competitionId);

    if (error) {
      throw new Error(`ランオフラウンド一括削除に失敗しました: ${error.message}`);
    }
  }

  async resolveAsJointWinner(competitionId: string, round: number): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('runoff_rounds')
      .update({ resolution: 'joint_winner' })
      .eq('competition_id', competitionId)
      .eq('round', round);

    if (error) {
      throw new Error(`ランオフラウンドの解決に失敗しました: ${error.message}`);
    }
  }
}
