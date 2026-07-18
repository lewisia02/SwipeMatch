import { randomUUID } from 'crypto';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Logo } from '@/lib/types/Logo';

const STORAGE_BUCKET = 'logos';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

interface LogoRow {
  id: string;
  image_url: string;
  uploader_name: string;
  memo: string;
  created_at: string;
}

function toLogo(row: LogoRow): Logo {
  return {
    id: row.id,
    imageUrl: row.image_url,
    uploaderName: row.uploader_name,
    memo: row.memo,
    createdAt: new Date(row.created_at),
  };
}

export class LogoRepository {
  async create(data: Omit<Logo, 'id' | 'createdAt'>): Promise<Logo> {
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('logos')
      .insert({
        image_url: data.imageUrl,
        uploader_name: data.uploaderName,
        memo: data.memo,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Logoの作成に失敗しました: ${error.message}`);
    }

    return toLogo(row as LogoRow);
  }

  async findAll(): Promise<Logo[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('logos').select('*');

    if (error) {
      throw new Error(`Logo一覧の取得に失敗しました: ${error.message}`);
    }

    return (data as LogoRow[]).map(toLogo);
  }

  // Post-MVPの投稿削除機能用（現状未使用）
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('logos').delete().eq('id', id);

    if (error) {
      throw new Error(`Logoの削除に失敗しました: ${error.message}`);
    }
  }

  async createSignedUploadUrl(contentType: string): Promise<{ uploadUrl: string; storagePath: string }> {
    const supabase = getSupabaseClient();
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? 'jpg';
    const storagePath = `${randomUUID()}.${extension}`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) {
      throw new Error(`署名付きURLの発行に失敗しました: ${error.message}`);
    }

    return { uploadUrl: data.signedUrl, storagePath };
  }

  // DB書き込み失敗時、アップロード済み画像を削除する補償処理用
  async deleteStorageObject(storagePath: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

    if (error) {
      throw new Error(`Storageオブジェクトの削除に失敗しました: ${error.message}`);
    }
  }

  getPublicUrl(storagePath: string): string {
    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }
}
