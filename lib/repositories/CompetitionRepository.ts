import { getSupabaseClient } from '@/lib/supabase/client';
import type { Competition, EventPhase } from '@/lib/types/Competition';

interface CompetitionRow {
  id: string;
  slug: string;
  title: string;
  status: 'active' | 'closed';
  current_phase: EventPhase;
  created_at: string;
  closed_at: string | null;
}

function toCompetition(row: CompetitionRow): Competition {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    currentPhase: row.current_phase,
    createdAt: new Date(row.created_at),
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
  };
}

export class CompetitionRepository {
  async create(data: { slug: string; title: string }): Promise<Competition> {
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('competitions')
      .insert({
        slug: data.slug,
        title: data.title,
        status: 'active',
        current_phase: 'submission',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Competitionの作成に失敗しました: ${error.message}`);
    }

    return toCompetition(row as CompetitionRow);
  }

  // 既存のactiveコンペ（0件または1件）をclosedに更新する。activeが無い場合は何もしない
  async closeActive(): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('competitions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('status', 'active');

    if (error) {
      throw new Error(`Competitionのクローズに失敗しました: ${error.message}`);
    }
  }

  async findBySlug(slug: string): Promise<Competition | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Competitionの取得に失敗しました: ${error.message}`);
    }

    return data ? toCompetition(data as CompetitionRow) : null;
  }

  async findById(id: string): Promise<Competition | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Competitionの取得に失敗しました: ${error.message}`);
    }

    return data ? toCompetition(data as CompetitionRow) : null;
  }

  async findActive(): Promise<Competition | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw new Error(`Competitionの取得に失敗しました: ${error.message}`);
    }

    return data ? toCompetition(data as CompetitionRow) : null;
  }

  async findAll(): Promise<Competition[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Competition一覧の取得に失敗しました: ${error.message}`);
    }

    return (data as CompetitionRow[]).map(toCompetition);
  }

  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('competitions').delete().eq('id', id);

    if (error) {
      throw new Error(`Competitionの削除に失敗しました: ${error.message}`);
    }
  }

  async updatePhase(id: string, phase: EventPhase): Promise<Competition> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('competitions')
      .update({ current_phase: phase })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Competitionのフェーズ更新に失敗しました: ${error.message}`);
    }

    return toCompetition(data as CompetitionRow);
  }
}
