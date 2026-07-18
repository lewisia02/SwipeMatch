import { getSupabaseClient } from '@/lib/supabase/client';
import type { AppSettings, EventPhase } from '@/lib/types/AppSettings';

const SETTINGS_ID = 'singleton';

interface AppSettingsRow {
  id: string;
  current_phase: EventPhase;
  updated_at: string;
}

function toAppSettings(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    currentPhase: row.current_phase,
    updatedAt: new Date(row.updated_at),
  };
}

export class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .single();

    if (error) {
      throw new Error(`AppSettingsの取得に失敗しました: ${error.message}`);
    }

    return toAppSettings(data as AppSettingsRow);
  }

  async updatePhase(phase: EventPhase): Promise<AppSettings> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('app_settings')
      .update({ current_phase: phase, updated_at: new Date().toISOString() })
      .eq('id', SETTINGS_ID)
      .select()
      .single();

    if (error) {
      throw new Error(`AppSettingsの更新に失敗しました: ${error.message}`);
    }

    return toAppSettings(data as AppSettingsRow);
  }
}
